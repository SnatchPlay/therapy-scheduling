import { existsSync } from "node:fs";
import { defineConfig, mergeConfig } from "vitest/config";
// «.mjs», а не «.mts»: без allowImportingTsExtensions TypeScript (npm run typecheck, next build) не приймає імпорт
// з розширенням .mts, а «./vitest.config.mjs» і TypeScript, і Vite зводять до vitest.config.mts.
import base from "./vitest.config.mjs";

// Покриття для npm run test:coverage (основа — koldovsky/2026-quitcode-08-quality-hw/materials/gates). npm test не змінюється.
//
// Підлога покриття — ЛИШЕ для доменних файлів, які її вже тримають (кожен файл окремо, perFile): шлях від src/lib/
// без «.ts». Файл, що поки нижче, видно в Summary — додаємо його сюди, коли тести його піднімуть (храповик: підлогу не
// знижуємо). Загальний відсоток не поріг: сторінки й server actions доводять тести бази (PGlite) та e2e, а не Vitest.
const FLOORED: string[] = ["clients", "health", "messages", "slots", "time"];
// Поріг на glob, що не знайшов жодного файлу, Vitest мовчки приймає: перейменований файл без підлоги лишив би job зеленим.
for (const name of FLOORED) {
  if (!existsSync(`src/lib/${name}.ts`)) throw new Error(`FLOORED: немає src/lib/${name}.ts — оновіть список у vitest.coverage.config.mts`);
}
// Фігурні дужки glob розкриваються лише з комою всередині, тож один файл пишемо без них.
const FLOORED_GLOB = FLOORED.length === 1 ? `src/lib/${FLOORED[0]}.ts` : `src/lib/{${FLOORED.join(",")}}.ts`;

export default mergeConfig(
  base,
  defineConfig({
    test: {
      coverage: {
        provider: "v8",
        // Без include звіт показав би лише імпортовані тестами файли — сторінки з 0 % зникли б.
        include: ["src/**/*.{ts,tsx}"],
        // Згенеровані типи, компоненти дизайн-системи (shadcn/ui) і історії Storybook — не код під тестами.
        exclude: ["src/lib/supabase/database.types.ts", "src/components/ui/**", "**/*.stories.tsx"],
        // html — для людей (coverage/index.html), json-summary — для npm run coverage:summary, json — для інших інструментів.
        reporter: ["text", "html", "json-summary", "json"],
        reportOnFailure: true,
        thresholds: FLOORED.length
          ? {
              [FLOORED_GLOB]: { statements: 90, branches: 85, functions: 90, lines: 90, perFile: true },
            }
          : {},
      },
    },
  }),
);
