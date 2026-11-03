import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import storybook from "eslint-plugin-storybook";
import vitest from "@vitest/eslint-plugin";

// AC ID, як його читає ac:coverage (AC_ID у scripts/lib/spec-lib.mjs): лише на початку назви тесту.
const AC = String.raw`AC-[A-Z]{2,12}-\d{2}`;
// Власні модулі, які не мокаємо: src/lib/** (крім адаптерів src/lib/supabase/**) і src/app/** — через аліас
// (@/lib/…, @/app/…) або шлях від src (src/lib/…, ../../src/lib/…). Відносні шляхи без src (./actions) правило не
// бачить. Слеш у регулярному виразі esquery пишемо як \x2f: буквальний «/» закрив би вираз.
const OWN_MODULE = String.raw`/^(@|((\.\.?\x2f)+)?src)\x2f(lib\x2f(?!supabase([^A-Za-z0-9_-]|$))[A-Za-z0-9_-]|app([^A-Za-z0-9_-]|$))/`;
const NO_OWN_MOCK =
  "Не мокайте власні модулі (src/lib/**, src/app/**) — тестуйте справжній код: SQL/RLS на PGlite, " +
  "введення-виведення — через передані залежності. Мок клієнта Supabase (@/lib/supabase/*) дозволено.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...storybook.configs["flat/recommended"],
  // Тести Vitest: вимкнений, сфокусований, порожній чи умовний тест — помилка, а не попередження: `npm run lint` має
  // --max-warnings 0, тож «warn» тут теж валив би CI. Основа блоку — koldovsky/2026-quitcode-08-quality-hw/materials/gates.
  {
    files: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      // .skip ховає AC від перевірки (у recommended — warn). Порожній .todo ловить ac:coverage, а не це правило.
      "vitest/no-disabled-tests": "error",
      // AC ID у назві тесту (it/test) — лише на початку: «… AC-ROOM-04 …» посередині ac:coverage не порахує. Назви
      // describe ac:coverage не читає, тож їх не обмежуємо.
      "vitest/valid-title": [
        "error",
        {
          mustNotMatch: {
            it: [String.raw`^(?!${AC}).*\b${AC}`, "AC ID — на самому початку назви тесту, інакше ac:coverage його не порахує."],
            test: [String.raw`^(?!${AC}).*\b${AC}`, "AC ID — на самому початку назви тесту, інакше ac:coverage його не порахує."],
          },
        },
      ],
      // Тест з if/switch сам вирішує, чи щось перевіряти (тернарні й `&&` правило не бачить).
      "vitest/no-conditional-in-test": "error",
      "vitest/no-conditional-expect": "error",
      // expect(value, "пояснення") — коректний Vitest.
      "vitest/valid-expect": ["error", { maxArgs: 2 }],
      // Помічники на кшталт expectNoInvite() теж перевірки.
      "vitest/expect-expect": ["error", { assertFunctionNames: ["expect", "expect*"] }],
      // rejects.toThrow() без тексту проходить на БУДЬ-ЯКІЙ помилці (одруківка в SQL, немає grant), а не на відмові з AC.
      "vitest/require-to-throw-message": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: `CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock)$/][arguments.0.value=${OWN_MODULE}]`,
          message: NO_OWN_MOCK,
        },
        {
          // vi.mock(import("@/lib/…")) — та сама заборона для форми з import().
          selector: `CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock)$/][arguments.0.source.value=${OWN_MODULE}]`,
          message: NO_OWN_MOCK,
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Зібраний Storybook (npm run build-storybook).
    "storybook-static/**",
    // Дані для тестів скриптів (навмисно «зламані» файли).
    "tests/fixtures/**",
    // Звіти й тимчасові копії інструментів якості (ESLint не читає .gitignore): покриття, кеш і копії мутантів fallow, звіт і пісочниця Stryker.
    "coverage/**",
    ".fallow/**",
    "reports/**",
    ".stryker-tmp/**",
  ]),
]);

export default eslintConfig;
