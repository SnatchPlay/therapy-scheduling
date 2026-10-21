// Тексти, які бачить користувач. Ті, що мають AC у коментарі, — дослівно з критеріїв приймання PM (requirements/2-…md).
// Server actions передають сторінці лише код (?msg=<код>), текст — звідси.
export const MESSAGES = {
  INVALID_CLIENT: "Enter the client's name and a valid email.", // AC-HOLD-11, AC-HOLD-15
  CLIENT_EXISTS: "A client with this email already exists.", // AC-HOLD-16
  CLIENT_CREATED: "Client created.",
  SLOT_UNAVAILABLE: "This slot is no longer available.", // AC-HOLD-03, AC-HOLD-04, AC-HOLD-17
  SLOT_STARTED: "This slot has already started and cannot be held.", // AC-HOLD-07
  HOLD_FORBIDDEN: "Only schedulers and admins can hold slots.", // AC-HOLD-08
  NO_FREE_SLOTS: "No free slots on this day.", // AC-HOLD-18
  HELD: "Slot held.",
  UNEXPECTED: "Something went wrong. Try again.",
} as const;

export type MessageCode = keyof typeof MESSAGES;

function isMessageCode(value: unknown): value is MessageCode {
  return typeof value === "string" && Object.hasOwn(MESSAGES, value);
}

/** Текст для ?msg=<код>; невідомий код — нічого не показуємо. */
export function messageFor(code: unknown): string | undefined {
  return isMessageCode(code) ? MESSAGES[code] : undefined;
}

/** Помилка функції бази (raise exception '<КОД>', міграція slots_and_holds) → код повідомлення. */
export function dbMessageCode(error: { message?: string }): MessageCode {
  return isMessageCode(error.message) ? error.message : "UNEXPECTED";
}

/** Помилка створення клієнта з бази → код (обмеження таблиці clients, міграція roles_and_clients). */
export function clientErrorCode(error: { code?: string; message?: string }): MessageCode {
  if (error.code === "23505" && error.message?.includes("clients_email_key")) return "CLIENT_EXISTS";
  if (error.code === "23514" && /clients_(full_name|email)_check/.test(error.message ?? "")) return "INVALID_CLIENT";
  return "UNEXPECTED";
}
