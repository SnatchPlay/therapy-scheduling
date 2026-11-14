import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { askModel } from "@/lib/ai/draft";
import { buildOutcome } from "@/lib/ai/intake";
import { PRODUCT_MODEL } from "@/lib/ai/models";
import { DRAFT_PROMPT_VERSION } from "@/lib/ai/prompts/draft";
import { scoreOutcome, type GoldenCase } from "@/lib/ai/score";
import casesJson from "./fixtures/golden/cases.json";
import recordedJson from "./fixtures/golden/recorded.json";

// Офлайн-реплей golden cases PM: без мережі й без ключа, тож працює в CI (`npm test`, job `app`). Відповіді моделі — СПРАВЖНІ,
// записані живим прогоном `RECORD=1 npm run eval` (modelId, дата й версія промпту в кожному записі). Перевіряє КОД навколо
// моделі (промпт із межею <document>, схема, правила чернетки, повідомлення), а НЕ якість моделі: її міряє живий прогін.
// «Сьогодні» — 2026-11-13: дати кейсів PM підібрано так, що очікуване не змінюється з 13 до 16 листопада.

type Recording = { modelId: string; recordedAt: string; promptVersion: string; text: string };
const cases = casesJson as GoldenCase[];
const recorded = recordedJson as Record<string, Recording>;
const TODAY = "2026-11-13";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

// Модель, що «відповідає» записаним текстом.
function replay(text: string, modelId: string) {
  return new MockLanguageModelV4({
    modelId,
    doGenerate: async () => ({ content: [{ type: "text", text }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] }),
  });
}

async function expectReplay(c: GoldenCase) {
  const rec = recorded[c.id];
  expect(rec, `немає запису для ${c.id} у recorded.json`).toBeDefined();
  const model = replay(rec.text, rec.modelId);
  const result = await askModel(c.input, TODAY, model);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(scoreOutcome(c.expected, buildOutcome(result.draft, TODAY)).mismatches).toEqual([]);
  // Недовірений вхід дійшов до моделі загорнутим як дані.
  expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain("<document>");
}

// Назва — звичайний рядок, що ПОЧИНАЄТЬСЯ з AC ID (шаблонний рядок ac:coverage не зарахує); кейси розкладено за таблицею PM.
describe("golden cases PM, офлайн-реплей справжніх відповідей", () => {
  it.each(cases.filter((c) => c.ac === "AC-INTAKE-01"))("AC-INTAKE-01: golden $id", (c) => expectReplay(c));
  it.each(cases.filter((c) => c.ac === "AC-INTAKE-02"))("AC-INTAKE-02: golden $id", (c) => expectReplay(c));
  it.each(cases.filter((c) => c.ac === "AC-INTAKE-04"))("AC-INTAKE-04: golden $id", (c) => expectReplay(c));
  it.each(cases.filter((c) => c.ac === "AC-INTAKE-05"))("AC-INTAKE-05: golden $id", (c) => expectReplay(c));
  it.each(cases.filter((c) => c.ac === "AC-INTAKE-06"))("AC-INTAKE-06: golden $id", (c) => expectReplay(c));
  it.each(cases.filter((c) => c.ac === "AC-INTAKE-07"))("AC-INTAKE-07: golden $id", (c) => expectReplay(c));

  it("кожен golden case має запис, записаний поточними версією промпту й моделлю", () => {
    const missing = cases.map((c) => c.id).filter((id) => !recorded[id]);
    expect(missing).toEqual([]);
    const stale = Object.entries(recorded)
      .filter(([, r]) => r.promptVersion !== DRAFT_PROMPT_VERSION)
      .map(([id]) => id);
    // Змінили DRAFT_PROMPT_VERSION — перезапишіть записи живим прогоном.
    expect(stale).toEqual([]);
    const otherModel = Object.entries(recorded)
      .filter(([, r]) => r.modelId !== PRODUCT_MODEL)
      .map(([id]) => id);
    // Змінили PRODUCT_MODEL — теж перезапишіть: інакше реплей доводить відповіді іншої моделі.
    expect(otherModel).toEqual([]);
  });
});
