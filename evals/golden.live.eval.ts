import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { askModel } from "@/lib/ai/draft";
import { buildOutcome, todayInPractice } from "@/lib/ai/intake";
import { PRODUCT_MODELS, makeProductModel } from "@/lib/ai/models";
import { DRAFT_PROMPT_VERSION } from "@/lib/ai/prompts/draft";
import { passRate, scoreOutcome, type GoldenCase } from "@/lib/ai/score";
import casesJson from "../tests/fixtures/golden/cases.json";

// `npm run eval` — ЖИВИЙ прогін golden cases PM на безкоштовних моделях OpenRouter. Ніколи не в `npm test` і не в CI.
// Основа — набір курсу materials/ai-feature, без LLM-судді: очікуване PM — точні поля й дослівні повідомлення.
// Потрібен ваш ключ у .env.local (OPENROUTER_API_KEY). Без ключа всі кейси пропускаються — це не помилка.
// Перший 429 зупиняє прогін: цей і решта кейсів — NOT RUN з причиною у звіті, у частку успіху не входять.
// Таймаут, помилка постачальника, відповідь не за схемою — FAIL з причиною (входять у частку успіху).
//   RUNS=2    — кілька прогонів поспіль для частки успіху.
//   RECORD=1  — успішні відповіді моделі дописати в tests/fixtures/golden/recorded.json (для офлайн-реплею в CI).

const cases = casesJson as GoldenCase[];
const key = process.env.OPENROUTER_API_KEY;
const RECORD = process.env.RECORD === "1";
const RUNS = Math.max(1, Number(process.env.RUNS ?? 1) || 1);
const RECORDED_PATH = "tests/fixtures/golden/recorded.json";
const REPORT_DIR = "evals/reports";

// Бюджет: на прогін — 10 викликів моделі з одного денного лічильника акаунта (50/день). Ланцюжок `models` цей ліміт не
// обходить, спроби fallback теж можуть рахуватися.
const NEEDED = RUNS * cases.length;
const GAP_MS = 3_000; // ≤ 20 запитів/хв

type Recording = { modelId: string; recordedAt: string; promptVersion: string; text: string };
// notRun — кейс не запускали через ліміт (429): у частку успіху не входить, у звіті — окремим рядком з причиною.
type Row = { run: number; id: string; ac: string; modelId: string; pass: boolean; notRun?: boolean; why?: string };
const rows: Row[] = [];
const fresh: Record<string, Recording> = {};
let stoppedAt: string | undefined;

describe.skipIf(!key)("golden cases PM, живий прогін (безкоштовні моделі OpenRouter)", () => {
  beforeAll(async () => {
    // Скільки безкоштовних запитів лишилось сьогодні (UTC-доба; у листопаді скидається о 02:00 за Києвом).
    const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } });
    const body = (await res.json()) as { data?: { free_model_daily_requests?: { remaining?: number } } };
    const remaining = body.data?.free_model_daily_requests?.remaining;
    if (typeof remaining === "number" && remaining < NEEDED) {
      throw new Error(`Сьогодні лишилось ${remaining} безкоштовних запитів, потрібно ${NEEDED}. Запустіть завтра або зменште RUNS.`);
    }
  });

  for (let run = 1; run <= RUNS; run++) {
    for (const c of cases) {
      it(`прогін ${run}: golden ${c.id} (${c.ac})`, async (ctx) => {
        if (stoppedAt) {
          rows.push({ run, id: c.id, ac: c.ac, modelId: "—", pass: false, notRun: true, why: `NOT RUN: зупинено після 429 (${stoppedAt})` });
          return ctx.skip();
        }
        await sleep(GAP_MS);
        // maxRetries 0: денний 429 повтором не виправити, повтор лише з'їдає ліміт.
        const today = todayInPractice();
        const result = await askModel(c.input, today, makeProductModel(key), { maxRetries: 0, timeoutMs: 90_000 });
        if (!result.ok) {
          // Рядок у звіт — ДО перевірки: інакше кейс зникає зі звіту, і частку успіху рахують з меншого знаменника.
          if (result.reason === "rate_limited") {
            stoppedAt = `${c.id}, прогін ${run}`;
            rows.push({ run, id: c.id, ac: c.ac, modelId: "—", pass: false, notRun: true, why: `NOT RUN: 429 — ${result.message}` });
            return ctx.skip();
          }
          rows.push({ run, id: c.id, ac: c.ac, modelId: "—", pass: false, why: `${result.reason}: ${result.message}` });
        }
        expect(result.ok, result.ok ? "" : `${result.reason}: ${result.message}`).toBe(true);
        if (!result.ok) return;
        const score = scoreOutcome(c.expected, buildOutcome(result.draft, today));
        rows.push({
          run,
          id: c.id,
          ac: c.ac,
          modelId: result.modelId,
          pass: score.pass,
          why: score.mismatches.map((m) => `${m.field}: очікували «${String(m.expected)}», отримали «${String(m.actual)}»`).join("; "),
        });
        // Записуємо ЛИШЕ успішні відповіді: офлайн-реплей у CI має лишатися зеленим.
        if (RECORD && score.pass) {
          fresh[c.id] = { modelId: result.modelId, recordedAt: new Date().toISOString(), promptVersion: DRAFT_PROMPT_VERSION, text: JSON.stringify(result.draft) };
        }
        expect(score.mismatches).toEqual([]);
      });
    }
  }

  afterAll(() => {
    console.table(rows); // яка модель з ланцюжка відповіла на кожен кейс: бал — за модель, а не «за AI»
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
    `- Промпт: \`${DRAFT_PROMPT_VERSION}\`; ланцюжок моделей: ${PRODUCT_MODELS.map((m) => `\`${m}\``).join(" → ")}`,
    `- Прогонів: ${RUNS}; кейсів у прогоні: ${cases.length}`,
    `- **Частка успіху: ${total.passed}/${total.total} (${Math.round(total.rate * 100)}%)** — з кейсів, що отримали відповідь`,
    `- Поріг PM: щонайменше 8 з 10, обов'язково GC-09 (відмова) і GC-10 (ін'єкція)`,
    `- Не запущено (NOT RUN): ${notRun.length}${stoppedAt ? ` — ліміт 429, зупинено на: ${stoppedAt}` : ""}`,
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
