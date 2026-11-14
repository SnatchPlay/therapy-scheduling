import type { IntakeOutcome } from "./intake";

// Один golden case PM: вхід → очікуване. Формат файлу — tests/fixtures/golden/cases.json; `ac` — критерій PM, до якого
// належить кейс (таблиця «Правило» у вимозі #36). Очікуване — точні поля форми й дослівне повідомлення (без LLM-судді).
export type GoldenCase = {
  id: string; // "GC-01"
  ac: string; // "AC-INTAKE-01"
  input: string;
  expected: { kind: "draft"; values: Record<string, string>; message: string } | { kind: "refused"; message: string };
};

/** Порівнює результат коду з очікуваним PM: вид (чернетка чи відмова), усі поля форми й повідомлення — точно. */
export function scoreOutcome(expected: GoldenCase["expected"], actual: IntakeOutcome) {
  const mismatches: { field: string; expected: unknown; actual: unknown }[] = [];
  if (expected.kind !== actual.kind) mismatches.push({ field: "kind", expected: expected.kind, actual: actual.kind });
  if (expected.message !== actual.message) mismatches.push({ field: "message", expected: expected.message, actual: actual.message });
  if (expected.kind === "draft" && actual.kind === "draft") {
    for (const [field, value] of Object.entries(expected.values)) {
      const got = actual.values[field as keyof typeof actual.values];
      if (got !== value) mismatches.push({ field, expected: value, actual: got });
    }
  }
  return { pass: mismatches.length === 0, mismatches };
}

/** Частка успіху (pass rate) — визначення з WS8: прогін на задачах із відомими відповідями → бал. */
export function passRate(results: { pass: boolean }[]): { passed: number; total: number; rate: number } {
  const passed = results.filter((r) => r.pass).length;
  return { passed, total: results.length, rate: results.length ? passed / results.length : 0 };
}
