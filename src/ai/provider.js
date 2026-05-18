import { GeminiProvider } from './gemini.js';

/**
 * AI Provider 팩토리 & 레지스트리
 *
 * 새로운 AI 추가 방법:
 * 1. ./{name}.js 에서 ProviderBase 상속받아 구현
 * 2. 이 파일 상단에 import 추가
 * 3. registry 객체에 등록
 */

// Provider 레지스트리
const registry = {};
const aliasMap = {};

function register(providerClass) {
  const name = providerClass.name.replace('Provider', '').toLowerCase();
  registry[name] = providerClass;

  for (const model of providerClass.getModels()) {
    aliasMap[model] = name;
  }
}

// Gemini 등록
register(GeminiProvider);

/**
 * AI Provider 생성
 * @param {string} modelName - 모델명 (예: gemini-1.5-flash)
 * @param {{ apiKey: string, model?: string }} config
 */
export function createProvider(modelName, config) {
  const providerName = aliasMap[modelName];
  if (!providerName) {
    throw new Error(
      `지원하지 않는 모델입니다: ${modelName}\n` +
      `사용 가능: ${getAvailableModels().join(', ')}`
    );
  }

  const ProviderClass = registry[providerName];
  return new ProviderClass(config);
}

/** 사용 가능한 모델 목록 */
export function getAvailableModels() {
  return Object.keys(aliasMap);
}
