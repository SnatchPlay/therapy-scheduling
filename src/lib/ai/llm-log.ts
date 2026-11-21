// Журнал AI-функції: один рядок JSON `llm.call` на кожен виклик моделі (модель, затримка, токени, стан, fallback, версія
// промпту, id запиту). Тексту користувача, промпту й відповіді моделі в схемі немає (див. src/lib/log.ts).
import { logEvent, type LogSchema } from "@/lib/log";

/** ok / needs_info / refused — відповідь моделі за схемою; unavailable — відповіді немає (ліміт, таймаут, збій). */
export const LLM_STATES = ["ok", "needs_info", "refused", "unavailable"] as const;
export type LlmState = (typeof LLM_STATES)[number];

export type LlmCall = {
  /** id запиту, щоб зв'язати рядок з іншими подіями цього запиту (напр. crypto.randomUUID()). */
  requestId: string;
  /** маршрут-шаблон, не адреса з параметрами: "/clients/new", "/clients/[id]". */
  route: string;
  /** id моделі, яка відповіла (або запитаної, якщо відповіді немає). */
  model: string;
  /** відповіла не основна модель ланцюжка; зараз модель одна (ADR 0008), тож завжди false. */
  fallbackUsed: boolean;
  state: LlmState;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  /** версія промпту, напр. DRAFT_PROMPT_VERSION = "intake-v1". */
  promptVersion: string;
  /** КОД причини (rate_limited, timeout, invalid_output, provider_error), ніколи не текст повідомлення про помилку. */
  errorKind?: string;
};

/** Схема llm.call: єдиний список полів, які взагалі можуть потрапити в журнал. */
export const LLM_CALL_SCHEMA = {
  requestId: "token",
  route: "path",
  model: "token",
  fallbackUsed: "boolean",
  state: LLM_STATES,
  latencyMs: "int",
  inputTokens: "int",
  outputTokens: "int",
  promptVersion: "token",
  errorKind: "token",
} as const satisfies LogSchema;

/** Пише рядок llm.call: unavailable — рівнем error (видно у фільтрі level:error), решта — info. Повертає рядок. */
export function logLlmCall(call: LlmCall): string {
  return logEvent("llm.call", call, LLM_CALL_SCHEMA, call.state === "unavailable" ? "error" : "info");
}
