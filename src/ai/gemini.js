import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { Provider } from './base.js';
import { logger } from '../utils/logger.js';

const SUPPORTED_MODELS = [
  'gemini-2.5-flash',        // 현재 잘 됨 ⭐ 추천
  'gemini-2.5-flash-lite',   // 경량, 잘 됨
  'gemini-flash-latest',     // 최신 Flash alias
  'gemini-flash-lite-latest', // 최신 Flash Lite alias
  'gemini-2.0-flash',        // 할당량 소진 시 fallback
  'gemini-2.0-flash-lite',   // 할당량 소진 시 fallback
  'gemini-2.5-pro',          // 고성능
  'gemma-4-26b-a4b-it',      // Gemma 4 (오픈 모델)
  'gemini-3-flash-preview',  // 최신 프리뷰
  'gemini-3-pro-preview',    // 최고 성능
];

const DISPLAY_NAMES = {
  'gemini-2.5-flash': 'Gemini 2.5 Flash ⭐',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'gemini-flash-latest': 'Gemini Flash (최신)',
  'gemini-flash-lite-latest': 'Gemini Flash Lite (최신)',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemma-4-26b-a4b-it': 'Gemma 4 26B (무료 오픈 모델)',
  'gemini-3-flash-preview': 'Gemini 3 Flash Preview',
  'gemini-3-pro-preview': 'Gemini 3 Pro Preview',
};

export class GeminiProvider extends Provider {
  constructor(config) {
    super(config);
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  /**
   * AI 채팅 생성
   */
  async generateChat(systemPrompt, history, userMessage) {
    const modelName = this.config.model || 'gemini-2.5-flash';

    // 세이프티 설정 (최대한 완화 — 캐릭터 설정/롤플레이 자유롭게)
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT,     threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,     threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ];

    const model = this.client.getGenerativeModel({ model: modelName, safetySettings });

    const generationConfig = {
      temperature: 0.95,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    };

    // History를 Gemini 포맷으로 변환
    // 시스템 프롬프트는 첫 번째 user 메시지 앞에 추가됨
    const geminiHistory = [];
    for (const msg of history) {
      if (msg.role === 'user') {
        geminiHistory.push({
          role: 'user',
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === 'model') {
        geminiHistory.push({
          role: 'model',
          parts: [{ text: msg.content }],
        });
      }
    }

    // 채팅 세션 시작
    const chat = model.startChat({
      history: geminiHistory,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig,
    });

    try {
      const result = await chat.sendMessage(userMessage);
      const response = result.response;
      const text = response.text();

      if (!text) {
        // 응답이 비어있으면 safety setting 문제일 수 있음
        const safetyRatings = response.promptFeedback?.safetyRatings || [];
        const blockedRatings = safetyRatings.filter((r) => r.blocked);
        if (blockedRatings.length > 0) {
          logger.warn(`[Gemini] Safety filter blocked response: ${JSON.stringify(blockedRatings)}`);
          return '⚠️ 안전 정책에 의해 차단된 응답입니다. 다른 질문으로 시도해주세요.';
        }
        return '(빈 응답)';
      }

      return text;
    } catch (err) {
      logger.error(`[Gemini] API Error: ${err.message}`);
      throw new Error(`Gemini API 오류: ${err.message}`);
    }
  }

  /**
   * 지원 모델 목록
   */
  static getModels() {
    return SUPPORTED_MODELS;
  }

  static getDisplayName(model) {
    return DISPLAY_NAMES[model] || model;
  }
}
