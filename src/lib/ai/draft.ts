import { APICallError, NoObjectGeneratedError, Output, RetryError, generateText, type LanguageModel } from "ai";
import { logLlmCall, type LlmCall } from "./llm-log";
import { DRAFT_PROMPT_VERSION, draftInstructions, wrapDocument } from "./prompts/draft";
import { DraftSchema, type ModelDraft } from "./schema";

// Модель передають параметром. Застосунок передає модель Claude (src/lib/ai/anthropic.ts),
// тести — MockLanguageModelV4 із записаною відповіддю. Тут немає `import "server-only"` і немає process.env,
// тому Vitest може імпортувати цей файл. Взято з набору курсу (materials/ai-feature).

export type ModelResult =
  | { ok: true; draft: ModelDraft; modelId: string }
  | { ok: false; reason: "invalid_output" | "rate_limited" | "timeout" | "provider_error"; message: string };

export type DraftOptions = {
  maxRetries?: number;
  timeoutMs?: number;
  /** Куди писати llm.call. Немає — журналу немає (так працюють golden-тести й eval). */
  log?: { requestId: string; route: string };
};

/** Питає модель про одне звернення. Не пише в базу й не має інструментів: модель повертає лише JSON за схемою. */
export async function askModel(text: string, today: string, model: LanguageModel, opts: DraftOptions = {}): Promise<ModelResult> {
  const started = performance.now();
  let outcome: ModelResult;
  let call: Pick<LlmCall, "model" | "state" | "inputTokens" | "outputTokens" | "errorKind">;
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
    outcome = { ok: true, draft: result.output, modelId: result.response.modelId };
    call = { model: result.response.modelId, state: result.output.status, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens };
  } catch (error) {
    outcome = classifyError(error);
    call = { model: typeof model === "string" ? model : model.modelId, state: "unavailable", errorKind: outcome.reason };
  }
  if (opts.log) {
    logLlmCall({ ...opts.log, fallbackUsed: false, latencyMs: performance.now() - started, promptVersion: DRAFT_PROMPT_VERSION, ...call });
  }
  return outcome;
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
