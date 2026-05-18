import {
  saveMessage,
  getRecentMessages,
  searchMessagesByKeywords,
  saveSession,
  loadSession,
  saveMemory,
  searchMemories,
  getAllMemories,
  getMessageCount,
  isConnected,
  extractKeywords,
} from './database.js';

const DEFAULT_SYSTEM_PROMPT = '당신은 도움이 되는 AI 비서입니다. 친절하고 자연스럽게 대답해주세요.';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_HISTORY_LENGTH = 50;

class SessionStore {
  constructor() {
    this.sessions = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;
  }

  async getOrCreate(channelId) {
    if (!this.sessions.has(channelId)) {
      // MongoDB에 저장된 세션 정보가 있는지 확인
      const saved = await loadSession(channelId);
      this.sessions.set(channelId, {
        history: [],
        systemPrompt: saved?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        model: saved?.model || DEFAULT_MODEL,
        autochat: saved?.autochat ?? true,
        createdAt: saved?.createdAt || Date.now(),
      });
    }
    return this.sessions.get(channelId);
  }

  get(channelId) {
    return this.sessions.get(channelId) || null;
  }

  /**
   * 대화 기록에 추가 + MongoDB에도 저장
   */
  async addMessage(channelId, role, content) {
    const session = await this.getOrCreate(channelId);
    session.history.push({ role, content, timestamp: Date.now() });

    if (session.history.length > MAX_HISTORY_LENGTH) {
      const excess = session.history.length - MAX_HISTORY_LENGTH;
      session.history.splice(0, excess);
    }

    // MongoDB에 영구 저장 (키워드 자동 추출됨)
    await saveMessage(channelId, role, content);
  }

  /**
   * 채널 컨텍스트 초기화 (MongoDB 메시지는 보존됨)
   */
  clear(channelId) {
    const existing = this.sessions.get(channelId);
    const systemPrompt = existing?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const model = existing?.model || DEFAULT_MODEL;
    const autochat = existing?.autochat ?? true;

    this.sessions.set(channelId, {
      history: [],
      systemPrompt,
      model,
      autochat,
      createdAt: Date.now(),
    });
  }

  async setSystemPrompt(channelId, prompt) {
    const session = await this.getOrCreate(channelId);
    session.systemPrompt = prompt;
    await saveSession(channelId, { systemPrompt: prompt });
  }

  async setModel(channelId, model) {
    const session = await this.getOrCreate(channelId);
    session.model = model;
    await saveSession(channelId, { model });
  }

  async setAutochat(channelId, enabled) {
    const session = await this.getOrCreate(channelId);
    session.autochat = enabled;
    await saveSession(channelId, { autochat: enabled });
  }

  async getHistory(channelId) {
    const session = await this.getOrCreate(channelId);
    return session.history;
  }

  /**
   * AI에 보낼 컨텍스트 구성
   * - 최근 N개 대화 + 키워드 검색 결과 + 기억
   */
  async buildContext(channelId, userMessage) {
    const session = await this.getOrCreate(channelId);

    // 0) 캐릭터 프로필 로드
    const { getProfile, profileToPrompt } = await import('./database.js');
    const profile = await getProfile(channelId);
    const profilePrompt = profileToPrompt(profile);

    // 1) 최근 대화 (메모리)
    const recentHistory = session.history.slice(-20);

    // 2) MongoDB에서 키워드 검색 (관련 과거 대화)
    const relatedMessages = await searchMessagesByKeywords(channelId, userMessage, 5);

    // 3) 영구 기억 검색
    const memories = await searchMemories(channelId, userMessage);
    const allMemories = await getAllMemories(channelId);

    // 컨텍스트 조립
    let context = [];

    // 시스템 프롬프트
    if (profilePrompt) {
      // 프로필이 있으면 프로필 + 시스템 프롬프트 합쳐서 전달
      context.push({ role: 'system', content: `${profilePrompt}\n\n${session.systemPrompt}` });
    } else {
      context.push({ role: 'system', content: session.systemPrompt });
    }

    // 저장된 기억이 있으면 맥락에 추가
    if (allMemories.length > 0) {
      const memoryText = allMemories
        .map((m) => `[기억] ${m.key}: ${m.value}`)
        .join('\n');
      context.push({
        role: 'system',
        content: `다음은 사용자에 대해 기억하고 있는 정보야:\n${memoryText}`,
      });
    }

    // 관련 과거 대화 (키워드 검색 결과)
    if (relatedMessages.length > 0) {
      const relatedText = relatedMessages
        .reverse()
        .map((m) => `[과거] ${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`)
        .join('\n');
      context.push({
        role: 'system',
        content: `사용자의 질문과 관련된 과거 대화야:\n${relatedText}`,
      });
    }

    // 최근 대화
    for (const msg of recentHistory) {
      context.push(msg);
    }

    return context;
  }

  /**
   * 대화 내용에서 중요한 정보 추출해서 기억 저장
   */
  async learnFromMessage(channelId, userMessage, aiReply) {
    // 중요 패턴 감지 (키워드 기반)
    const patterns = [
      // "내 이름은 X야", "나는 X라고 해"
      { regex: /내\s*(이름|닉네임|별명)(은|는|이)\s*(\S+)/i, key: 'user_name' },
      { regex: /(나는|난|전)\s*(\S+)(?:이?야|라고\s*해|예요|입니다)/i, key: 'user_name' },
      // "내 강아지/고양이 이름은 X야"
      { regex: /내\s*(강아지|고양이|반려동물|개|고양이)\s*(이름|이)\s*(\S+)/i, key: 'pet_name' },
      // "나는 X를 좋아해"
      { regex: /(나는|난|전)\s*(\S+)\s*(좋아해|제일\s*좋아|최애)/i, key: 'user_likes' },
      // "나는 X를 싫어해"
      { regex: /(나는|난|전)\s*(\S+)\s*(싫어해|제일\s*싫어)/i, key: 'user_dislikes' },
    ];

    const combined = userMessage + '\n' + aiReply;

    for (const pattern of patterns) {
      const match = combined.match(pattern.regex);
      if (match) {
        const value = match.slice(1).join(' ').trim();
        const keywords = extractKeywords(value);
        await saveMemory(channelId, pattern.key, value, keywords);
      }
    }
  }

  async getContextInfo(channelId) {
    const session = await this.getOrCreate(channelId);
    const history = session.history;
    const totalChars = history.reduce((acc, msg) => acc + msg.content.length, 0);
    const userMessages = history.filter((m) => m.role === 'user').length;
    const botMessages = history.filter((m) => m.role === 'model').length;
    const dbCount = await getMessageCount(channelId);

    return {
      model: session.model,
      systemPrompt: session.systemPrompt,
      totalMessages: history.length,
      dbMessages: dbCount,
      userMessages,
      botMessages,
      totalChars,
      autochat: session.autochat,
      createdAt: new Date(session.createdAt).toLocaleString('ko-KR'),
    };
  }

  getStats() {
    let totalChannels = 0;
    let totalMessages = 0;
    for (const [, session] of this.sessions) {
      totalChannels++;
      totalMessages += session.history.length;
    }
    return { totalChannels, totalMessages };
  }
}

export const sessionStore = new SessionStore();
