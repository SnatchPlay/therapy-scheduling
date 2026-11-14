import { APICallError, NoObjectGeneratedError, Output, RetryError, generateText, type LanguageModel } from "ai";
import { draftInstructions, wrapDocument } from "./prompts/draft";
import { DraftSchema, type ModelDraft } from "./schema";

// Чиста функція: модель передають параметром. Застосунок передає модель Claude (src/lib/ai/anthropic.ts),
// тести — MockLanguageModelV4 із записаною відповіддю. Тут немає `import "server-only"` і немає process.env,
// тому Vitest може імпортувати цей файл. Взято з набору курсу (materials/ai-feature).

export type ModelResult =
  | { ok: true; draft: ModelDraft; modelId: string }
  | { ok: false; reason: "invalid_output" | "rate_limited" | "timeout" | "provider_error"; message: string };

export type DraftOptions = { maxRetries?: number; timeoutMs?: number };

/** Питає модель про одне звернення. Нічого не пише й не має інструментів: модель повертає лише JSON за схемою. */
export async function askModel(text: string, today: string, model: LanguageModel, opts: DraftOptions = {}): Promise<ModelResult> {
  try {
    const result = await generateText({
      model,
      instructions: draftInstructions(today), // `system` в AI SDK 7 застаріле
      messages: [{ role: "user", content: [{ type: "text", text: wrapDocument(text) }] }],
      output: Output.object({ name: "draft", schema: DraftSchema }), // generateObject застарілий
      // Без `temperature`: Claude Haiku 5.5 її не приймає (провайдер її ігнорує з попередженням). Стабільність — схема й правила коду.
      // Повтор — ще один платний виклик і ще один запит у ліміт хвилини: 0–1, не типові 2.
      maxRetries: opts.maxRetries ?? 1,
      timeout: opts.timeoutMs ?? 45_000,
    });
    // result.output уже перевірено за DraftSchema (інакше — виняток NoObjectGeneratedError).
    return { ok: true, draft: result.output, modelId: result.response.modelId };
  } catch (error) {
    return classifyError(error);
  }
}

export function classifyError(error: unknown): Extract<ModelResult, { ok: false }> {
  // Після повторів AI SDK загортає останню помилку в RetryError — спершу розгортаємо.
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (NoObjectGeneratedError.isInstance(cause)) {
    return { ok: false, reason: "invalid_output", message: "model output did not match the schema" };
  }
  if (APICallError.isInstance(cause) && cause.statusCode === 429) {
    return { ok: false, reason: "rate_limited", message: "rate limit reached, try later" };
  }
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) {
    return { ok: false, reason: "timeout", message: "model did not answer in time" };
  }
  return { ok: false, reason: "provider_error", message: cause instanceof Error ? cause.message : String(cause) };
}
