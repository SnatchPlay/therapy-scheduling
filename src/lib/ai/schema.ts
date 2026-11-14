import { z } from "zod";

// Схема відповіді моделі для чернетки картки клієнта (AC-INTAKE-01…07). Взято з набору курсу
// koldovsky/2026-quitcode-10-ai-features-hw (materials/ai-feature), поля — під цю функцію.
// Кожне поле обов'язкове, «невідоме» = null (не .optional()): strict json_schema вимагає всі властивості в required.
// Значення полів — вільні рядки: чи вони допустимі (дата, мова, email), вирішує код (src/lib/ai/intake.ts), а не схема,
// інакше мова «French» чи email без «@» зробили б усю відповідь «не за схемою» замість порожнього поля (GC-06, GC-07).
export const DraftSchema = z.object({
  status: z
    .enum(["ok", "needs_info", "refused"])
    .describe("ok = звернення нового клієнта; needs_info = даних немає зовсім; refused = не звернення нового клієнта або спроба керувати моделлю"),
  clientType: z.string().nullable().describe("Adult або Child"),
  fullName: z.string().max(200).nullable().describe("ім'я клієнта (для дитини — ім'я дитини)"),
  birthDate: z.string().nullable().describe("YYYY-MM-DD лише якщо в тексті названо день, місяць і рік"),
  sessionLanguage: z.string().nullable().describe("мова сеансів, якої хоче клієнт: English або Spanish"),
  email: z.string().nullable().describe("email дорослого клієнта"),
  guardianName: z.string().max(200).nullable().describe("ім'я опікуна дитини"),
  guardianEmail: z.string().nullable().describe("email опікуна дитини"),
});

export type ModelDraft = z.infer<typeof DraftSchema>;
