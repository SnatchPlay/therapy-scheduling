// НЕГАТИВНІ КОНТРОЛІ — навмисно хибні очікування. Не AC-тести: назви починаються з NC-, а не з AC ID, тож ac:coverage
// їх не рахує, а звичайний прогін їх пропускає (проєкт chromium має grepInvert @negative-control).
// Запуск: npm run uat:nc (UAT_NEGATIVE_CONTROLS=1 → проєкт negative-controls). Лише читання: безпечно на проді.
// Що мають показати:
//   NC-1 — у тесті неправильний очікуваний текст → перевірка падає → FAIL, хоч би що сказав агент;
//   NC-2 — текст «Тоді» у вимозі уточнено, а тест і застосунок ні → перевірки зелені, агент звіряє кадр із НОВИМ текстом
//          і не погоджується → NEEDS-HUMAN (розбіжність іде до людини).
import { expect, test } from "@playwright/test";
import { authFile } from "./support/roles";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

test.use({ storageState: authFile("scheduler") });

const MISSING_ID = "00000000-0000-4000-8000-000000000016";
const CLAUSE = "scheduler1 бачить повідомлення «This client card doesn't exist.», і жодних даних клієнтів не бачить";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

const openMissingCard = async (page: import("@playwright/test").Page) => {
  await given("scheduler1 увійшов у застосунок", async () => {
    await page.goto("/clients");
  });
  await when("scheduler1 відкриває посилання на картку, якої не існує", async () => {
    await page.goto(`/clients/${MISSING_ID}`);
  });
};

test(
  "NC-1 (AC-CARD-16, навмисно хибне очікування в тесті: інший текст повідомлення)",
  {
    tag: ["@negative-control"],
    annotation: [
      { type: "ac", description: "AC-CARD-16" },
      { type: "case", description: "NC-1" },
    ],
  },
  async ({ page }) => {
    await openMissingCard(page);
    await thenStep(page, { clause: CLAUSE, visible: ["повідомлення «This client card doesn't exist.»"] }, async () => {
      await expect(page.locator("main").getByRole("alert")).toHaveText("This client card does not exist.", { timeout: 5_000 });
    });
  },
);

test(
  "NC-2 (AC-CARD-16, текст «Тоді» у вимозі уточнено, тест і застосунок — ні)",
  {
    tag: ["@negative-control"],
    annotation: [
      { type: "ac", description: "AC-CARD-16" },
      { type: "case", description: "NC-2" },
      {
        type: "ac-text",
        description:
          "AC-CARD-16: Дано картки клієнта, на яку веде посилання, не існує. Коли scheduler1 відкриває це посилання. Тоді scheduler1 бачить повідомлення «This client card was not found.», і жодних даних клієнтів не бачить.",
      },
    ],
  },
  async ({ page }) => {
    await openMissingCard(page);
    await thenStep(page, { clause: CLAUSE, visible: ["повідомлення «This client card doesn't exist.»"] }, async () => {
      await expect(page.locator("main").getByRole("alert")).toHaveText("This client card doesn't exist.");
    });
  },
);
