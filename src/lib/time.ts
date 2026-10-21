// Час практики: America/Los_Angeles, формат РРРР-ММ-ДД ГГ:ХХ, 24 години (припущення вимоги PM).
export const PRACTICE_TIME_ZONE = "America/Los_Angeles";

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: PRACTICE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function practiceParts(value: string | Date) {
  return Object.fromEntries(parts.formatToParts(new Date(value)).map((p) => [p.type, p.value]));
}

/** «2026-11-03 14:30» */
export function formatPracticeDateTime(value: string | Date): string {
  const p = practiceParts(value);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** «14:30» */
export function formatPracticeTime(value: string | Date): string {
  const p = practiceParts(value);
  return `${p.hour}:${p.minute}`;
}

/** Сьогоднішня дата практики «2026-11-03». */
export function practiceDate(value: string | Date = new Date()): string {
  const p = practiceParts(value);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * Існуюча календарна дата «РРРР-ММ-ДД» (Date.parse приймає й «2026-02-31», тож звіряємо туди й назад).
 * Рік 0000 JavaScript приймає, а тип date у Postgres — ні: day_slots упав би з помилкою.
 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

const DAY_MS = 86_400_000;
const atNoonUtc = (date: string) => new Date(`${date}T12:00:00Z`);

/** Дата через n днів: «2026-11-02» + 7 → «2026-11-09». Дата практики вже локальна, тож це чиста арифметика дат. */
export function addDays(date: string, days: number): string {
  return new Date(atNoonUtc(date).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Понеділок тижня, якому належить дата (тиждень — з понеділка по неділю, AC-HOLD-30): «2026-11-04» → «2026-11-02». */
export function weekStart(date: string): string {
  return addDays(date, -((atNoonUtc(date).getUTCDay() + 6) % 7));
}

/** День тижня англійською для заголовка дня: «2026-11-02» → «Monday». */
export function weekdayName(date: string): string {
  return atNoonUtc(date).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}
