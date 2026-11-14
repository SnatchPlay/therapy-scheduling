import { defineConfig } from "vitest/config";

// `npm run eval` — живий прогін golden cases на Claude. Ніколи не частина `npm test` / CI:
// основний vitest.config.mts бере лише *.test.ts(x), а цей — лише evals/**/*.eval.ts.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    fileParallelism: false, // по одному запиту: пауза між запитами у eval
    testTimeout: 120_000,
    hookTimeout: 30_000,
    expect: { requireAssertions: true },
  },
});
