// Тексти, які бачить користувач. Ті, що мають AC у коментарі, — дослівно з критеріїв приймання PM (requirements/2-…md).
// Server actions передають сторінці лише код (?msg=<код>), текст — звідси.
export const MESSAGES = {
  INVALID_CLIENT: "Enter the client's name and a valid email.", // AC-HOLD-11, AC-HOLD-15
  CLIENT_EXISTS: "A client with this email already exists.", // AC-HOLD-16
  INVALID_GUARDIAN: "Enter the guardian's name and a valid email.", // AC-CARD-03
  // Тексти без AC: PM ще не відповіла (Sofiia-pm/therapy-scheduling-spec#21), взято з рекомендації до того питання.
  INVALID_CLIENT_NAME: "Enter the client's name.",
  INVALID_BIRTH_DATE: "Enter a date of birth that is not in the future.",
  INVALID_LANGUAGE: "Select a session language.",
  CARD_FORBIDDEN: "Only schedulers and admins can create client cards.", // AC-CARD-06
  CLIENT_ACCESS_DENIED: "You don't have access to this client.", // AC-CARD-05, AC-CARD-08
  NO_CLIENTS: "No clients yet. Clients appear here when a scheduler holds a slot with you.", // AC-CARD-09
  NO_ACCESS: "Your account has no access yet. Contact an administrator.", // AC-CARD-11
  CLIENT_CREATED: "Client created.",
  SLOT_UNAVAILABLE: "This slot is no longer available.", // AC-HOLD-03, AC-HOLD-04, AC-HOLD-17
  SLOT_STARTED: "This slot has already started and cannot be held.", // AC-HOLD-07
  CLIENT_OVERLAP: "This client already has a hold or session at this time.", // AC-HOLD-25
  HOLD_FORBIDDEN: "Only schedulers and admins can hold slots.", // AC-HOLD-08
  NO_FREE_SLOTS: "No free slots on this day.", // AC-HOLD-18
  HOLD_EXPIRED: "This hold has expired. Hold the slot again.", // AC-HOLD-13
  HOLD_ALREADY_CONFIRMED: "This hold is already confirmed.", // AC-HOLD-36
  CONFIRM_FORBIDDEN: "Only schedulers and admins can confirm holds.", // AC-HOLD-14
  CONFIRM_SLOT_STARTED: "This slot has already started and cannot be confirmed.", // AC-HOLD-22
  HELD: "Slot held.",
  CONFIRMED: "Hold confirmed.",
  UNEXPECTED: "Something went wrong. Try again.",
} as const;

export type MessageCode = keyof typeof MESSAGES;

function isMessageCode(value: unknown): value is MessageCode {
  return typeof value === "string" && Object.hasOwn(MESSAGES, value);
}

const SUCCESS_CODES: readonly MessageCode[] = ["CLIENT_CREATED", "HELD", "CONFIRMED"];

export type Notice = { text: string; tone: "success" | "error" };

/** Повідомлення для ?msg=<код>: успіх показуємо як інформацію, решту — як помилку; невідомий код — нічого. */
export function noticeFor(code: unknown): Notice | undefined {
  if (!isMessageCode(code)) return undefined;
  return { text: MESSAGES[code], tone: SUCCESS_CODES.includes(code) ? "success" : "error" };
}

/** Помилка функції бази (raise exception '<КОД>', міграція slots_and_holds) → код повідомлення. */
export function dbMessageCode(error: { message?: string }): MessageCode {
  return isMessageCode(error.message) ? error.message : "UNEXPECTED";
}

export type ClientType = "Adult" | "Child";

// Помилки створення клієнта з бази (обмеження й тригер таблиці clients, міграції roles_and_clients і client_card):
// код Postgres (без `codes` — будь-який) і текст, який його ідентифікує. Для дитини помилка імені не згадує email.
const CLIENT_ERRORS: { codes?: string[]; match: RegExp; message: MessageCode | ((type: ClientType) => MessageCode) }[] = [
  { codes: ["23505"], match: /clients_email_key/, message: "CLIENT_EXISTS" },
  { codes: ["23514"], match: /clients_(guardian|child_shape)_check/, message: "INVALID_GUARDIAN" },
  { codes: ["23514"], match: /clients_session_language_check/, message: "INVALID_LANGUAGE" },
  {
    codes: ["23514"],
    match: /clients_full_name_check/,
    message: (type) => (type === "Child" ? "INVALID_CLIENT_NAME" : "INVALID_CLIENT"),
  },
  { codes: ["23514"], match: /clients_(email|adult_shape)_check/, message: "INVALID_CLIENT" },
  // Невірний формат дати (22007, 22008) і дата в майбутньому (тригер normalize_client: raise exception).
  { codes: ["22007", "22008"], match: /(?:)/, message: "INVALID_BIRTH_DATE" },
  { match: /^INVALID_BIRTH_DATE$/, message: "INVALID_BIRTH_DATE" },
  // RLS: insert у clients лише для планувальника й адміністратора (AC-CARD-06); «permission denied» (немає grant) — збій.
  { codes: ["42501"], match: /row-level security/, message: "CARD_FORBIDDEN" },
];

export function clientErrorCode(error: { code?: string; message?: string }, clientType: ClientType = "Adult"): MessageCode {
  const rule = CLIENT_ERRORS.find(
    (r) => (!r.codes || r.codes.includes(error.code ?? "")) && r.match.test(error.message ?? ""),
  );
  if (!rule) return "UNEXPECTED";
  return typeof rule.message === "function" ? rule.message(clientType) : rule.message;
}
