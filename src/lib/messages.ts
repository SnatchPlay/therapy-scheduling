// Тексти, які бачить користувач, — дослівно з критеріїв приймання PM (requirements/2-…md).
// Server actions передають сторінці лише код (?msg=<код>), текст — звідси.
export const MESSAGES = {
  INVALID_CLIENT: "Enter the client's name and a valid email.", // AC-HOLD-11, AC-HOLD-15
  CLIENT_EXISTS: "A client with this email already exists.", // AC-HOLD-16
  CLIENT_CREATED: "Client created.",
  UNEXPECTED: "Something went wrong. Try again.",
} as const;

export type MessageCode = keyof typeof MESSAGES;

export function isMessageCode(value: unknown): value is MessageCode {
  return typeof value === "string" && Object.hasOwn(MESSAGES, value);
}

/** Текст для ?msg=<код>; невідомий код — нічого не показуємо. */
export function messageFor(code: unknown): string | undefined {
  return isMessageCode(code) ? MESSAGES[code] : undefined;
}

/** Помилка створення клієнта з бази → код (обмеження таблиці clients, міграція roles_and_clients). */
export function clientErrorCode(error: { code?: string; message?: string }): MessageCode {
  if (error.code === "23505" && error.message?.includes("clients_email_key")) return "CLIENT_EXISTS";
  if (error.code === "23514" && /clients_(full_name|email)_check/.test(error.message ?? "")) return "INVALID_CLIENT";
  return "UNEXPECTED";
}
