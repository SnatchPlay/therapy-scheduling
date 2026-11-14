import { draftIncomplete, INTAKE_MESSAGES } from "@/lib/messages";
import type { ModelDraft } from "./schema";

// Правила чернетки, які перевіряє КОД, а не промпт (design.md, Р32): модель лише читає текст, а що з цього потрапляє
// у форму, вирішують ці функції за «Припущеннями» вимоги PM #36. Чисті функції: «сьогодні» — параметр.

/** Поля форми нової картки (імена полів — як у ClientCardForm). */
export type IntakeValues = {
  client_type: string;
  full_name: string;
  birth_date: string;
  session_language: string;
  email: string;
  guardian_name: string;
  guardian_email: string;
};

export type IntakeOutcome =
  | { kind: "draft"; values: IntakeValues; message: string; missing: string[] }
  | { kind: "refused"; message: string };

const PRACTICE_TIME_ZONE = "America/Los_Angeles";
const LANGUAGES = ["English", "Spanish"] as const;
const ADULT_AGE = 18;

/** «Сьогодні» за часом практики (America/Los_Angeles), РРРР-ММ-ДД: вимога PM, «Припущення». */
export function todayInPractice(now: Date = new Date()): string {
  // Локаль en-CA форматує дату саме як РРРР-ММ-ДД.
  return new Intl.DateTimeFormat("en-CA", { timeZone: PRACTICE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

const clean = (value: string | null): string => value?.trim() ?? "";

/** Повна справжня календарна дата РРРР-ММ-ДД не пізніша за сьогодні; інакше порожньо (AC-INTAKE-05). */
function validBirthDate(value: string | null, today: string): string {
  const text = clean(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return "";
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real && text <= today ? text : "";
}

/** Повних років на «сьогодні»: обидві дати вже в РРРР-ММ-ДД. */
function ageOn(today: string, birthDate: string): number {
  const [ty, tm, td] = today.split("-").map(Number);
  const [by, bm, bd] = birthDate.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Email — малими літерами без пробілів; без «@» поле порожнє (форматні помилки ловить база під час створення картки). */
function cleanEmail(value: string | null): string {
  const email = clean(value).toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(email) ? email : "";
}

function cleanLanguage(value: string | null): string {
  const text = clean(value).toLowerCase();
  return LANGUAGES.find((l) => l.toLowerCase() === text) ?? "";
}

function cleanType(value: string | null): "Adult" | "Child" | "" {
  const text = clean(value).toLowerCase();
  return text === "adult" ? "Adult" : text === "child" ? "Child" : "";
}

/** Тип: молодший за 18 за датою народження — завжди «Child» (GC-03, GC-05), інакше — тип від моделі. */
function resolveType(draft: ModelDraft, birthDate: string, today: string): "Adult" | "Child" | "" {
  return birthDate && ageOn(today, birthDate) < ADULT_AGE ? "Child" : cleanType(draft.clientType);
}

/** Поля форми: email дорослого лише для «Adult», поля опікуна лише для «Child». */
function fieldsFor(draft: ModelDraft, type: "Adult" | "Child" | "", birthDate: string): IntakeValues {
  return {
    client_type: type,
    full_name: clean(draft.fullName),
    birth_date: birthDate,
    session_language: cleanLanguage(draft.sessionLanguage),
    email: type === "Adult" ? cleanEmail(draft.email) : "",
    guardian_name: type === "Child" ? clean(draft.guardianName) : "",
    guardian_email: type === "Child" ? cleanEmail(draft.guardianEmail) : "",
  };
}

/** Модель не знайшла в тексті жодних даних клієнта — це не звернення нового клієнта. */
function hasNoClientData(draft: ModelDraft, type: string, birthDate: string): boolean {
  const found = [draft.fullName, draft.sessionLanguage, draft.email, draft.guardianName, draft.guardianEmail].some((v) => clean(v));
  return !type && !birthDate && !found;
}

/**
 * «Missing: …»: порожні обов'язкові поля в порядку форми (Client type, Name, Date of birth, Session language, далі Email для
 * дорослого або Guardian name і Guardian email для дитини; без типу пари email-полів немає).
 */
function missingLabels(values: IntakeValues): string[] {
  const type = values.client_type;
  const required: [boolean, string][] = [
    [type === "", "Client type"],
    [values.full_name === "", "Name"],
    [values.birth_date === "", "Date of birth"],
    [values.session_language === "", "Session language"],
    [type === "Adult" && values.email === "", "Email"],
    [type === "Child" && values.guardian_name === "", "Guardian name"],
    [type === "Child" && values.guardian_email === "", "Guardian email"],
  ];
  return required.filter(([isMissing]) => isMissing).map(([, label]) => label);
}

/** Відповідь моделі → відмова або чернетка з повідомленням (AC-INTAKE-01, 02, 04, 05, 06, 07). */
export function buildOutcome(draft: ModelDraft, today: string): IntakeOutcome {
  const refused: IntakeOutcome = { kind: "refused", message: INTAKE_MESSAGES.DRAFT_REFUSED };
  if (draft.status === "refused") return refused;

  const birthDate = validBirthDate(draft.birthDate, today);
  const type = resolveType(draft, birthDate, today);
  if (hasNoClientData(draft, type, birthDate)) return refused;

  const values = fieldsFor(draft, type, birthDate);
  const missing = missingLabels(values);
  return { kind: "draft", values, missing, message: missing.length ? draftIncomplete(missing) : INTAKE_MESSAGES.DRAFT_READY };
}
