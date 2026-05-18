/**
 * 채널별 AI 세션 관리
 * 
 * 구조:
 *   sessions = Map<channelId, Session>
 *   Session = {
 *     history: Message[],
 *     systemPrompt: string,
 *     model: string,
 *     tokenCount: number (approximate)
 *   }
 */

const DEFAULT_SYSTEM_PROMPT = '당신은 도움이 되는 AI 비서입니다. 친절하고 자연스럽게 대답해주세요.';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_HISTORY_LENGTH = 150; // 메시지 개수 제한 (Gemini는 컨텍스트가 길기 때문)

class SessionStore {
  constructor() {
    // channelId -> Session
    this.sessions = new Map();
  }

  /**
   * 채널의 세션을 가져오거나 새로 생성
   */
  getOrCreate(channelId) {
    if (!this.sessions.has(channelId)) {
      this.sessions.set(channelId, {
        history: [],
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        model: DEFAULT_MODEL,
        autochat: true,     // ← 기본 ON
        createdAt: Date.now(),
      });
    }
    return this.sessions.get(channelId);
  }

  /**
   * 채널 세션 가져오기 (없으면 null)
   */
  get(channelId) {
    return this.sessions.get(channelId) || null;
  }

  /**
   * 대화 기록에 추가
   */
  addMessage(channelId, role, content) {
    const session = this.getOrCreate(channelId);
    session.history.push({ role, content, timestamp: Date.now() });

    // 너무 길어지면 앞쪽 자르기
    if (session.history.length > MAX_HISTORY_LENGTH) {
      const excess = session.history.length - MAX_HISTORY_LENGTH;
      session.history.splice(0, excess);
    }
  }

  /**
   * 채널의 컨텍스트 초기화
   */
  clear(channelId) {
    const existing = this.sessions.get(channelId);
    const systemPrompt = existing?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const model = existing?.model || DEFAULT_MODEL;

    this.sessions.set(channelId, {
      history: [],
      systemPrompt,
      model,
      autochat: existing?.autochat ?? true,
      createdAt: Date.now(),
    });
  }

  /**
   * 시스템 프롬프트 설정
   */
  setSystemPrompt(channelId, prompt) {
    const session = this.getOrCreate(channelId);
    session.systemPrompt = prompt;
  }

  /**
   * AI 모델 변경
   */
  setModel(channelId, model) {
    const session = this.getOrCreate(channelId);
    session.model = model;
  }

  /**
   * 대화 기록 전체 가져오기
   */
  getHistory(channelId) {
    const session = this.getOrCreate(channelId);
    return session.history;
  }

  /**
   * 컨텍스트 요약 정보
   */
  /**
   * 자동 응답 모드 설정
   */
  setAutochat(channelId, enabled) {
    const session = this.getOrCreate(channelId);
    session.autochat = enabled;
  }

  getContextInfo(channelId) {
    const session = this.getOrCreate(channelId);
    const history = session.history;
    const totalChars = history.reduce((acc, msg) => acc + msg.content.length, 0);
    const userMessages = history.filter((m) => m.role === 'user').length;
    const botMessages = history.filter((m) => m.role === 'model').length;

    return {
      model: session.model,
      systemPrompt: session.systemPrompt,
      totalMessages: history.length,
      userMessages,
      botMessages,
      totalChars,
      createdAt: new Date(session.createdAt).toLocaleString('ko-KR'),
    };
  }

  /**
   * 모든 세션 통계
   */
  getStats() {
    let totalChannels = 0;
    let totalMessages = 0;

    for (const [channelId, session] of this.sessions) {
      totalChannels++;
      totalMessages += session.history.length;
    }

    return { totalChannels, totalMessages };
  }
}

// 싱글톤
export const sessionStore = new SessionStore();
