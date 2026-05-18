/**
 * AI Provider 기본 추상 클래스
 * 
 * 새 AI를 추가하려면 이 클래스를 상속받아 구현:
 * - constructor(config)
 * - generateChat(systemPrompt, history, userMessage) -> Promise<string>
 * - static getModels() -> string[]
 */

export class Provider {
  /** @param {{ apiKey: string, model?: string }} config */
  constructor(config) {
    this.config = config;
  }

  /**
   * @param {string} systemPrompt
   * @param {{ role: string, content: string }[]} history
   * @param {string} userMessage
   * @returns {Promise<string>}
   */
  async generateChat(systemPrompt, history, userMessage) {
    throw new Error('Not implemented');
  }

  /** 지원하는 모델 이름 목록 */
  static getModels() {
    return [];
  }
}
