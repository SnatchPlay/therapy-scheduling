// UAT: чернетка картки клієнта зі звернення (AI). «Тоді» — дослівно з openspec/specs/intake-draft (AC PM requirements/…).
// Сценарії НІЧОГО не пишуть у базу: чернетка лише заповнює форму, «Create client» ніхто не натискає. Кожен запит чернетки —
// один платний виклик Claude і один запис у ліміт 10 чернеток на годину користувача scheduler1: сценаріїв два, запит один на кожен.
// Потрібна жива модель: на розгорнутому застосунку (UAT_BASE_URL) ключ ANTHROPIC_API_KEY є у Vercel Production; локально —
// у .env.local. Без ключа (CI збирає застосунок без нього, e2e.yml) застосунок відповів би «The assistant is unavailable…»,
// тож сценарії не реєструються — це не послаблення перевірки, а відсутня передумова.
import { expect, test, type Page } from "@playwright/test";
import { authFile } from "./support/roles";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

const DRAFT_READY = "Draft ready. Check the fields and create the card.";
const UNAVAILABLE = "The assistant is unavailable right now. Fill in the form manually.";
const DRAFT_REFUSED =
  "This text can't be used to draft a client card. Paste the client's request or fill in the form manually.";
// Текст звернення з AC-INTAKE-01 дослівно.
const INTAKE_TEXT =
  "Hi, my name is Client Ten, I was born on May 14, 1990. I'd like individual sessions in English. My email is client10@example.test.";
const NOT_A_CLIENT_REQUEST = "Can you recommend a good book about anxiety?";
// Відповідь моделі чекаємо довше за типові 5 с: таймаут виклику моделі — 45 с, плюс один повтор.
const MODEL_WAIT = 100_000;

// Без передумови файл не реєструє сценаріїв (а не `test.skip`: eslint-plugin-playwright забороняє skip без причини в звіті).
const liveModel = Boolean(process.env.UAT_BASE_URL || process.env.ANTHROPIC_API_KEY);
test.use({ storageState: authFile("scheduler") });
test.setTimeout(150_000);

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

/**
 * Чекає на будь-яку відповідь панелі й лише потім звіряє її з очікуваною: без ключа застосунок одразу каже «unavailable»,
 * і тест має впасти з цим поясненням, а не висіти ціле очікування моделі.
 */
async function expectDraftOutcome(page: Page, expected: string) {
  const outcome = [DRAFT_READY, DRAFT_REFUSED, UNAVAILABLE]
    .map((text) => page.getByText(text, { exact: true }))
    .reduce((any, next) => any.or(next));
  await expect(outcome).toBeVisible({ timeout: MODEL_WAIT });
  await expect(
    outcome,
    "помічник відповів не так, як чекає AC (якщо «unavailable» — у Vercel Production немає ANTHROPIC_API_KEY або модель недоступна)",
  ).toHaveText(expected);
}

/** Картки у списку `/clients`: усі й лише «Client Ten». */
async function cardCounts(page: Page) {
  const cards = page.getByTestId("client-card");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return { all: await cards.count(), clientTen: await cards.getByRole("link", { name: "Client Ten", exact: true }).count() };
}

if (liveModel) {
  test.describe("AC-INTAKE-03", () => {
    let cardsBefore = { all: 0, clientTen: 0 };

    test(
      "AC-INTAKE-03: чернетку за текстом з AC-INTAKE-01 заповнено у формі, але картку не створено — у списку клієнтів «Client Ten» немає",
      { tag: ["@uat", "@ai"], annotation: { type: "ac", description: "AC-INTAKE-03" } },
      async ({ page }) => {
        await given("чернетку за текстом з AC-INTAKE-01 заповнено у формі нової картки", async () => {
          // На проді «Client Ten» може вже бути (створена вручну до UAT): тоді доказом є незмінна кількість карток, а не нуль.
          await page.goto("/clients");
          cardsBefore = await cardCounts(page);
          test.info().annotations.push({ type: "client-ten-before", description: String(cardsBefore.clientTen) });

          await page.goto("/clients/new");
          await page.getByLabel("Client request").fill(INTAKE_TEXT);
          await page.getByRole("button", { name: "Draft from request" }).click();
          await expectDraftOutcome(page, DRAFT_READY);
          await expect(page.getByLabel("Name")).toHaveValue("Client Ten");
          await expect(page.getByLabel("Email")).toHaveValue("client10@example.test");
        });

        await when("scheduler1 не створює картку й відкриває список клієнтів", async () => {
          await page.goto("/clients");
        });

        await thenStep(
          page,
          {
            clause: "картки «Client Ten» у списку немає: картку створює лише сам планувальник, коли зберігає форму",
            visible: [`список клієнтів: карток «Client Ten» у ньому ${cardsBefore.clientTen} (як і до чернетки), нової серед них немає`],
            hidden: [
              `до чернетки «Client Ten» було ${cardsBefore.clientTen}, усіх карток ${cardsBefore.all}: після чернетки кількості ті самі`,
              ...(cardsBefore.clientTen > 0
                ? ["картка «Client Ten» уже існувала до UAT (створена вручну), тому нуль карток на цій базі неможливий"]
                : []),
            ],
          },
          async () => {
            await expect(page.getByTestId("viewer")).toContainText("scheduler1@example.test");
            await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
            // Карток «Client Ten» не побільшало (на чистій базі їх 0, як у AC) і загалом карток стільки ж, скільки було.
            expect(await cardCounts(page)).toEqual(cardsBefore);
          },
        );
      },
    );
  });

  test.describe("AC-INTAKE-06", () => {
    test(
      "AC-INTAKE-06: текст не про нового клієнта — поля форми не змінено (Name лишається «Client Fifteen»), scheduler1 бачить повідомлення про відмову",
      { tag: ["@uat", "@ai"], annotation: { type: "ac", description: "AC-INTAKE-06" } },
      async ({ page }) => {
        await given("у формі нової картки вже введено Name «Client Fifteen»", async () => {
          await page.goto("/clients/new");
          await page.getByLabel("Name").fill("Client Fifteen");
        });

        await when("scheduler1 просить скласти чернетку з тексту звернення «Can you recommend a good book about anxiety?»", async () => {
          await page.getByLabel("Client request").fill(NOT_A_CLIENT_REQUEST);
          await page.getByRole("button", { name: "Draft from request" }).click();
          await expectDraftOutcome(page, DRAFT_REFUSED);
        });

        await thenStep(
          page,
          {
            clause:
              "поля форми не змінено (Name лишається «Client Fifteen»), і scheduler1 бачить повідомлення «This text can't be used to draft a client card. Paste the client's request or fill in the form manually.»",
            visible: [
              "Name у формі лишається «Client Fifteen»",
              "повідомлення «This text can't be used to draft a client card. Paste the client's request or fill in the form manually.»",
            ],
            hidden: ["решта полів форми порожня: чернетка нічого не заповнила"],
          },
          async () => {
            await expect(page.getByTestId("viewer")).toContainText("scheduler1@example.test");
            // Після відповіді панель одна: перемонтування лишало стару копію форми (два #intake_text) — виявив UAT на проді.
            await expect(page.locator("#intake_text")).toHaveCount(1);
            await expect(page.getByLabel("Name")).toHaveValue("Client Fifteen");
            await expect(page.getByLabel("Client type")).toHaveValue("");
            await expect(page.getByLabel("Date of birth (YYYY-MM-DD)")).toHaveValue("");
            await expect(page.getByLabel("Session language")).toHaveValue("");
            await expect(page.getByText(DRAFT_REFUSED, { exact: true })).toBeVisible();
          },
        );
      },
    );
  });
}
