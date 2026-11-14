// UAT: картка клієнта. «Тоді» — дослівно з вимог PM (requirements/19-…). Лише читання: безпечно на проді.
import { expect, test, type Page } from "@playwright/test";
import { ROLES, authFile, switchRole, withRole, type Role } from "./support/roles";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

const NO_ACCESS = "You don't have access to this client.";
const NOT_FOUND = "This client card doesn't exist.";
// Адреса, якої в базі немає: валідний uuid, але не створений жодною карткою.
const MISSING_ID = "00000000-0000-4000-8000-000000000016";

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

/** Картки зі списку `/clients` поточної ролі: id із посилання й ім'я. */
async function listedClients(page: Page) {
  await page.goto("/clients");
  const links = page.getByTestId("client-card").getByRole("link");
  return Promise.all(
    (await links.all()).map(async (link) => ({
      id: (await link.getAttribute("href"))!.replace("/clients/", ""),
      name: (await link.innerText()).trim(),
    })),
  );
}

/** Значення, яких не має бути на сторінці відмови: імена, email і дати з картки. */
const secretsOf = (name: string, cardText: string) => [
  name,
  ...(cardText.match(/[\w.+-]+@example\.test/g) ?? []),
  ...(cardText.match(/\d{4}-\d{2}-\d{2}/g) ?? []),
];

test.describe("AC-CARD-05", () => {
  test(
    "AC-CARD-05: терапевт відкриває за прямим посиланням картку клієнта іншого терапевта — повідомлення «You don't have access to this client.», даних клієнта немає, картка не змінилась",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-CARD-05" } },
    async ({ page, browser }) => {
      // AC-CARD-05: відкриває therapist1, клієнт — свій лише для therapist2; ролі не міняємо місцями.
      const opener: Role = "therapist";
      const owner: Role = "therapist2";
      let clientId = "";
      let secrets: string[] = [];
      let cardBefore = "";
      const cardOf = (ownerPage: Page) => ownerPage.goto(`/clients/${clientId}`).then(() => ownerPage.locator("main").innerText());

      await given("клієнт — «свій клієнт» лише для одного терапевта: є в його списку клієнтів і немає в списку іншого", async () => {
        const lists = {
          therapist: await withRole(browser, "therapist", listedClients),
          therapist2: await withRole(browser, "therapist2", listedClients),
        };
        const client = lists.therapist2.find((c) => !lists.therapist.some((x) => x.id === c.id));
        expect(
          client,
          "передумова AC-CARD-05 не виконана: на проді немає клієнта, що є лише в списку therapist2 (і немає в therapist1). Створіть утримання «Held» у слоті therapist2 для клієнта без утримань у therapist1; роль-opener міняти місцями не можна, бо AC каже: відкриває therapist1",
        ).toBeDefined();
        clientId = client!.id;
        cardBefore = await withRole(browser, owner, cardOf);
        secrets = secretsOf(client!.name, cardBefore);
      });

      await when("інший терапевт відкриває картку цього клієнта за прямим посиланням", async () => {
        await switchRole(page, opener);
        await page.goto(`/clients/${clientId}`);
      });

      await thenStep(
        page,
        {
          clause:
            "бачить повідомлення «You don't have access to this client.», жодних даних клієнта не показано, і картка клієнта не змінилася",
          visible: ["повідомлення «You don't have access to this client.»"],
          hidden: [
            "жодних даних клієнта: на сторінці немає його імені, email і дат",
            "картка клієнта не змінилася: власник бачить ті самі дані до й після",
          ],
        },
        async () => {
          // Сценарій виконано від імені саме therapist1, як у AC.
          await expect(page.getByTestId("viewer")).toContainText(ROLES[opener]);
          await expect(page.locator("main").getByRole("alert")).toHaveText(NO_ACCESS);
          await expect(page.getByTestId("client-card")).toHaveCount(0);
          const text = await page.locator("main").innerText();
          for (const secret of secrets) expect(text).not.toContain(secret);
          expect(await withRole(browser, owner, cardOf)).toBe(cardBefore);
        },
      );
    },
  );
});

test.describe("AC-CARD-16", () => {
  test.use({ storageState: authFile("scheduler") });

  test(
    "AC-CARD-16: картки, на яку веде посилання, не існує — scheduler бачить «This client card doesn't exist.», therapist — «You don't have access to this client.», даних клієнтів немає",
    { tag: ["@uat"], annotation: { type: "ac", description: "AC-CARD-16" } },
    async ({ page }) => {
      const noClientData = async () => {
        await expect(page.getByTestId("client-card")).toHaveCount(0);
        expect(await page.locator("main").innerText()).not.toMatch(/@example\.test|\d{4}-\d{2}-\d{2}/);
      };

      await given("картки клієнта, на яку веде посилання, не існує", async () => {
        expect((await listedClients(page)).map((c) => c.id)).not.toContain(MISSING_ID);
      });

      await when("scheduler1 відкриває це посилання", async () => {
        await page.goto(`/clients/${MISSING_ID}`);
      });
      await thenStep(
        page,
        {
          clause: "scheduler1 бачить повідомлення «This client card doesn't exist.», і жодних даних клієнтів не бачить",
          visible: ["повідомлення «This client card doesn't exist.»"],
          hidden: ["жодних даних клієнтів: карток і email на сторінці немає"],
        },
        async () => {
          await expect(page.getByTestId("viewer")).toContainText("scheduler1@example.test");
          await expect(page.locator("main").getByRole("alert")).toHaveText(NOT_FOUND);
          await noClientData();
        },
      );

      await when("а потім therapist1 відкриває це саме посилання", async () => {
        await switchRole(page, "therapist");
        await page.goto(`/clients/${MISSING_ID}`);
      });
      await thenStep(
        page,
        {
          clause: "therapist1 бачить повідомлення «You don't have access to this client.», і жодних даних клієнтів не бачить",
          visible: ["повідомлення «You don't have access to this client.»"],
          hidden: ["жодних даних клієнтів: карток і email на сторінці немає"],
        },
        async () => {
          await expect(page.getByTestId("viewer")).toContainText("therapist1@example.test");
          await expect(page.locator("main").getByRole("alert")).toHaveText(NO_ACCESS);
          await noClientData();
        },
      );
    },
  );
});
