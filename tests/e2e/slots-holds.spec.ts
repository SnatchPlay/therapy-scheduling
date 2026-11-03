// UAT: сторінки планувальника недоступні терапевту. «Тоді» — дослівно з вимог PM (requirements/2-…).
// Лише читання: безпечно на проді.
import { expect, test, type Page } from "@playwright/test";
import { authFile, withRole } from "./support/roles";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

const FORBIDDEN = "Only schedulers and admins can view this page.";

test.use({ storageState: authFile("therapist") });

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

const holdCount = async (page: Page) => {
  await page.goto("/holds");
  return page.getByTestId("hold").count();
};

test(
  "AC-HOLD-44: терапевт відкриває за прямим посиланням список утримань планувальника, а потім слоти іншого терапевта — повідомлення «Only schedulers and admins can view this page.», без утримань і даних клієнтів",
  { tag: ["@uat"], annotation: { type: "ac", description: "AC-HOLD-44" } },
  async ({ page, browser }) => {
    let therapist2Id = "";
    let holdsBefore = 0;
    const refusalOnly = async () => {
      await expect(page.getByTestId("viewer")).toContainText("therapist1@example.test");
      await expect(page.locator("main").getByRole("alert")).toHaveText(FORBIDDEN);
      await expect(page.getByTestId("hold")).toHaveCount(0);
      await expect(page.locator("main").locator("ul, table, li")).toHaveCount(0);
      expect(await page.locator("main").innerText()).not.toMatch(/@/);
    };

    await given("therapist1 увійшов у застосунок; утримання й слоти therapist2 видно планувальнику", async () => {
      await page.goto("/schedule");
      await expect(page.getByTestId("viewer")).toContainText("therapist1@example.test");
      await withRole(browser, "scheduler", async (scheduler) => {
        holdsBefore = await holdCount(scheduler);
        await scheduler.goto("/slots");
        // Точний збіг: на проді є й «PM Therapist Two» (акаунт PM), підрядок знайшов би обох.
        therapist2Id = (await scheduler.locator("#therapist option", { hasText: /^Therapist Two$/ }).getAttribute("value"))!;
      });
      expect(therapist2Id, "планувальник бачить терапевта therapist2 у списку слотів").toBeTruthy();
      // З нулем утримань «жодне утримання не змінилося» нічого б не доводило (0 = 0).
      expect(holdsBefore, "є утримання, які можна порівняти до й після").toBeGreaterThan(0);
    });

    await when("він відкриває за прямим посиланням список утримань планувальника", async () => {
      await page.goto("/holds");
    });
    await thenStep(
      page,
      {
        clause:
          "бачить повідомлення «Only schedulers and admins can view this page.», жодних утримань, імен чи email клієнтів не показано",
        visible: ["повідомлення «Only schedulers and admins can view this page.»"],
        hidden: ["жодних утримань, імен чи email клієнтів: списку, таблиці й адрес email на сторінці немає"],
      },
      refusalOnly,
    );

    await when("а потім відкриває слоти therapist2 на 2026-11-03", async () => {
      await page.goto(`/slots?therapist=${therapist2Id}&day=2026-11-03`);
    });
    await thenStep(
      page,
      {
        clause:
          "в обох випадках він бачить повідомлення «Only schedulers and admins can view this page.», жодних утримань, імен чи email клієнтів не показано, і жодне утримання не змінилося",
        visible: ["повідомлення «Only schedulers and admins can view this page.»"],
        hidden: [
          "жодних утримань, імен чи email клієнтів: списку, таблиці й адрес email на сторінці немає",
          "жодне утримання не змінилося: кількість утримань у планувальника така сама, як до відкриття сторінок",
        ],
      },
      async () => {
        await refusalOnly();
        expect(await withRole(browser, "scheduler", holdCount)).toBe(holdsBefore);
      },
    );
  },
);
