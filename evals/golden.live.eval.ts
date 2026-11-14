import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, describe, expect, it } from "vitest";
import { askModel } from "@/lib/ai/draft";
import { buildOutcome, todayInPractice } from "@/lib/ai/intake";
import { PRODUCT_MODEL, makeProductModel } from "@/lib/ai/models";
import { DRAFT_PROMPT_VERSION } from "@/lib/ai/prompts/draft";
import { passRate, scoreOutcome, type GoldenCase } from "@/lib/ai/score";
import casesJson from "../tests/fixtures/golden/cases.json";

// `npm run eval` — ЖИВИЙ прогін golden cases PM на Claude (ADR 0007). Ніколи не в `npm test` і не в CI.
// Основа — набір курсу materials/ai-feature, без LLM-судді: очікуване PM — точні поля й дослівні повідомлення.
// Потрібен ваш ключ у .env.local (ANTHROPIC_API_KEY); кожен виклик платний (~10 викликів Haiku на прогін). Без ключа всі кейси пропускаються — це не помилка.
// Перший 429 зупиняє прогін: цей і решта кейсів — NOT RUN з причиною у звіті, у частку успіху не входять.
// Таймаут, помилка постачальника, відповідь не за схемою — FAIL з причиною (входять у частку успіху).
//   RUNS=2    — кілька прогонів поспіль для частки успіху.
//   RECORD=1  — успішні відповіді моделі дописати в tests/fixtures/golden/recorded.json (для офлайн-реплею в CI).

const cases = casesJson as GoldenCase[];
const key = process.env.ANTHROPIC_API_KEY;
const RECORD = process.env.RECORD === "1";
const RUNS = Math.max(1, Number(process.env.RUNS ?? 1) || 1);
const RECORDED_PATH = "tests/fixtures/golden/recorded.json";
const REPORT_DIR = "evals/reports";

// Пауза між запитами, щоб не впертися в ліміт хвилини; 429 тут рідкість, але перший же зупиняє прогін (див. нижче).
const GAP_MS = 1_000;

type Recording = { modelId: string; recordedAt: string; promptVersion: string; text: string };
// notRun — кейс не запускали через ліміт (429): у частку успіху не входить, у звіті — окремим рядком з причиною.
type Row = { run: number; id: string; ac: string; modelId: string; pass: boolean; notRun?: boolean; why?: string };
const rows: Row[] = [];
const fresh: Record<string, Recording> = {};
let stoppedAt: string | undefined;

type CaseResult = { status: "skipped" } | { status: "failed"; message: string } | { status: "scored"; mismatches: unknown[] };

// Один кейс: звертається до моделі, дописує рядок у звіт і (з RECORD=1) запам'ятовує успішну відповідь.
async function evalCase(c: GoldenCase, run: number): Promise<CaseResult> {
  const base = { run, id: c.id, ac: c.ac };
  if (stoppedAt) {
    rows.push({ ...base, modelId: "—", pass: false, notRun: true, why: `NOT RUN: зупинено після 429 (${stoppedAt})` });
    return { status: "skipped" };
  }
  await sleep(GAP_MS);
  // maxRetries 0: повтор — ще один платний виклик, а 429 хвилинного ліміту повтором одразу не виправити.
  const today = todayInPractice();
  const result = await askModel(c.input, today, makeProductModel(key), { maxRetries: 0, timeoutMs: 90_000 });
  if (!result.ok) {
    if (result.reason === "rate_limited") {
      stoppedAt = `${c.id}, прогін ${run}`;
      rows.push({ ...base, modelId: "—", pass: false, notRun: true, why: `NOT RUN: 429 — ${result.message}` });
      return { status: "skipped" };
    }
    // Рядок у звіт — ДО перевірки: інакше кейс зникає зі звіту, і частку успіху рахують з меншого знаменника.
    const message = `${result.reason}: ${result.message}`;
    rows.push({ ...base, modelId: "—", pass: false, why: message });
    return { status: "failed", message };
  }
  const score = scoreOutcome(c.expected, buildOutcome(result.draft, today));
  const why = score.mismatches.map((m) => `${m.field}: очікували «${String(m.expected)}», отримали «${String(m.actual)}»`).join("; ");
  rows.push({ ...base, modelId: result.modelId, pass: score.pass, why });
  // Записуємо ЛИШЕ успішні відповіді: офлайн-реплей у CI має лишатися зеленим.
  if (RECORD && score.pass) {
    fresh[c.id] = { modelId: result.modelId, recordedAt: new Date().toISOString(), promptVersion: DRAFT_PROMPT_VERSION, text: JSON.stringify(result.draft) };
  }
  return { status: "scored", mismatches: score.mismatches };
}

describe.skipIf(!key)("golden cases PM, живий прогін (Claude)", () => {
  for (let run = 1; run <= RUNS; run++) {
    for (const c of cases) {
      it(`прогін ${run}: golden ${c.id} (${c.ac})`, async (ctx) => {
        const result = await evalCase(c, run);
        if (result.status === "skipped") return ctx.skip();
        expect(result).toEqual({ status: "scored", mismatches: [] });
      });
    }
  }

  afterAll(() => {
    console.table(rows); // кожен кейс: яка модель відповіла й чи пройшов
    writeReport();
    if (RECORD && Object.keys(fresh).length > 0) {
      // Злиття, а не заміна: прогін, обірваний 429, зберігає старі записи решти кейсів.
      let old: Record<string, Recording> = {};
      try {
        old = JSON.parse(readFileSync(RECORDED_PATH, "utf8")) as Record<string, Recording>;
      } catch {
        // Файлу ще немає — перший прогін із записом.
      }
      writeFileSync(RECORDED_PATH, JSON.stringify({ ...old, ...fresh }, null, 2) + "\n");
    }
  });
});

// Звіт для домашки: частка успіху загалом і за моделлю + кожен кейс. Файл комітять (він без секретів).
function writeReport() {
  if (rows.length === 0) return;
  // Частка успіху — лише з кейсів, що дістали відповідь; NOT RUN (ліміт) — окремо, не як FAIL і не мовчки.
  const ran = rows.filter((r) => !r.notRun);
  const notRun = rows.filter((r) => r.notRun);
  const total = passRate(ran);
  const byModel = new Map<string, Row[]>();
  for (const r of ran) byModel.set(r.modelId, [...(byModel.get(r.modelId) ?? []), r]);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const lines = [
    `# Живий прогін golden cases PM — ${new Date().toISOString()}`,
    "",
    `- Промпт: \`${DRAFT_PROMPT_VERSION}\`; модель: \`${PRODUCT_MODEL}\``,
    `- Прогонів: ${RUNS}; кейсів у прогоні: ${cases.length}`,
    `- **Частка успіху: ${total.passed}/${total.total} (${Math.round(total.rate * 100)}%)** — з кейсів, що отримали відповідь`,
    `- Поріг PM: щонайменше 8 з 10, обов'язково GC-09 (відмова) і GC-10 (ін'єкція)`,
    `- Не запущено (NOT RUN): ${notRun.length}${stoppedAt ? ` — ліміт 429 (rate limit), зупинено на: ${stoppedAt}` : ""}`,
    "",
    "| Модель, що відповіла | Пройшло | Усього |",
    "|---|---|---|",
    ...[...byModel].map(([m, rs]) => `| \`${m}\` | ${passRate(rs).passed} | ${rs.length} |`),
    "",
    "| Прогін | Кейс | AC | Модель | Результат | Причина / помилка |",
    "|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.run} | ${r.id} | ${r.ac} | \`${r.modelId}\` | ${r.notRun ? "NOT RUN" : r.pass ? "✅" : "❌"} | ${(r.why ?? "").replaceAll("|", "/")} |`),
    "",
  ];
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(`${REPORT_DIR}/${stamp}.md`, lines.join("\n"));
  console.log(`Звіт: ${REPORT_DIR}/${stamp}.md`);
}
