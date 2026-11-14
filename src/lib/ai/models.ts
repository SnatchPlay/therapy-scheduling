import { createAnthropic } from "@ai-sdk/anthropic";

// Модель чернетки картки — Claude Haiku 5.5: найдешевша модель сімейства, для витягування полів з коротких текстів досить (ADR 0007).
// Одна модель, без ланцюжка fallback: Anthropic API не має «зникаючих» безкоштовних моделей і денного ліміту, як OpenRouter :free.
export const PRODUCT_MODEL = "claude-haiku-5-5";

// Фабрика приймає ключ параметром і НЕ читає process.env: так її можна імпортувати в eval-скрипті.
// У коді застосунку модель бере лише src/lib/ai/anthropic.ts (server-only).
export function makeProductModel(apiKey: string | undefined) {
  return createAnthropic({ apiKey })(PRODUCT_MODEL);
}
