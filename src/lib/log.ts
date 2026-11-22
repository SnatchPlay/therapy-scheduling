// Структурований журнал: одна подія = один рядок JSON у Runtime Logs Vercel. Лише поля зі схеми (allowlist) і лише
// у вузькому форматі, тож вільний текст (повідомлення користувача, промпт, відповідь моделі, e-mail, cookie) у журнал
// потрапити не може, навіть якщо його передали випадково. Нове поле = нове правило в схемі події.

/** Як перевіряється значення поля. Не підходить під правило — поле викидаємо мовчки. */
export type FieldRule =
  | "token" //   коротке ідентифікатор-подібне значення: літери, цифри, . _ : / - (модель, id запиту, код помилки)
  | "path" //    шлях маршруту: /, /clients/[id], /api/health — без ?query і #
  | "int" //     ціле число ≥ 0 (токени, мілісекунди); дробове округлюємо
  | "boolean"
  | readonly string[]; // перелік дозволених значень (enum)

export type LogSchema = Readonly<Record<string, FieldRule>>;
export type LogValue = string | number | boolean;
export type LogLevel = "info" | "error";

/** Найдовше значення рядка в журналі: довше — обрізаємо (id, моделі й маршрути коротші). */
const MAX_STRING = 120;

const TOKEN = /^[A-Za-z0-9._:/-]+$/;
const PATH = /^\/[A-Za-z0-9._~\-/[\]()@]*$/;
const EVENT = /^[a-z][a-z0-9_.]{0,59}$/;

const isNonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Правило формату → перевірка. Окремі маленькі функції замість одного switch: так їх легше читати й тестувати. */
const RULES: Record<Exclude<FieldRule, readonly string[]>, (value: unknown) => LogValue | undefined> = {
  token: (value) => (typeof value === "string" && TOKEN.test(value) ? value.slice(0, MAX_STRING) : undefined),
  path: (value) => (typeof value === "string" && PATH.test(value) ? value.slice(0, MAX_STRING) : undefined),
  int: (value) => (isNonNegative(value) ? Math.round(value) : undefined),
  boolean: (value) => (typeof value === "boolean" ? value : undefined),
};

function clean(value: unknown, rule: FieldRule): LogValue | undefined {
  if (typeof rule === "string") return RULES[rule](value);
  // Перелік дозволених значень (enum).
  return typeof value === "string" && rule.includes(value) ? value : undefined;
}

/** Лишає тільки поля зі схеми, що пройшли перевірку формату. Невідомі й «криві» поля — викидає. */
export function pickAllowed(fields: Readonly<Record<string, unknown>>, schema: LogSchema): Record<string, LogValue> {
  const out: Record<string, LogValue> = {};
  for (const [key, rule] of Object.entries(schema)) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
    const value = clean(fields[key], rule);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/** Рядок JSON події: спершу event і ts (час UTC), далі дозволені поля. Перенесень рядка всередині немає. */
export function formatEvent(event: string, fields: Readonly<Record<string, unknown>>, schema: LogSchema): string {
  if (!EVENT.test(event)) throw new Error(`log: invalid event name`);
  return JSON.stringify({ event, ts: new Date().toISOString(), ...pickAllowed(fields, schema) });
}

/**
 * Пише одну подію в журнал (на Vercel — Runtime Logs; на Hobby вони живуть 1 годину).
 * console.error Vercel показує як error.
 * Повертає записаний рядок — зручно для тестів.
 */
export function logEvent(
  event: string,
  fields: Readonly<Record<string, unknown>>,
  schema: LogSchema,
  level: LogLevel = "info",
): string {
  const line = formatEvent(event, fields, schema);
  console[level](line);
  return line;
}
