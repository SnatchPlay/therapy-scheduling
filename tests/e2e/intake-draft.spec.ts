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
// Текст звернення за сценарієм AC-INTAKE-01, але з іменем, якого на проді немає. Картка «Client Ten» там уже є (створена
// вручну до UAT), і на кадрі «картки немає» вона суперечила б «Тоді». Чернетка нічого не створює, тож це ім'я лишається вільним.
const NAME = "Client Tenfold";
const EMAIL = "client10fold@example.test";
const INTAKE_TEXT = `Hi, my name is ${NAME}, I was born on May 14, 1990. I'd like individual sessions in English. My email is ${EMAIL}.`;
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

/** Картки у списку `/clients`: усі й лише з іменем NAME. */
async function cardCounts(page: Page) {
  const cards = page.getByTestId("client-card");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return { all: await cards.count(), named: await cards.getByRole("link", { name: NAME, exact: true }).count() };
}

if (liveModel) {
  test.describe("AC-INTAKE-03", () => {
    let cardsBefore = { all: 0, named: 0 };

    test(
      `AC-INTAKE-03: чернетку за текстом з AC-INTAKE-01 заповнено у формі, але картку не створено — у списку клієнтів «${NAME}» немає`,
      { tag: ["@uat", "@ai"], annotation: { type: "ac", description: "AC-INTAKE-03" } },
      async ({ page }) => {
        await given("чернетку за текстом з AC-INTAKE-01 заповнено у формі нової картки", async () => {
          await page.goto("/clients");
          cardsBefore = await cardCounts(page);
          expect(
            cardsBefore.named,
            `передумова AC-INTAKE-03 не виконана: картка «${NAME}» уже є на проді; без неї «картки немає» нічого б не довело`,
          ).toBe(0);

          await page.goto("/clients/new");
          await page.getByLabel("Client request").fill(INTAKE_TEXT);
          await page.getByRole("button", { name: "Draft from request" }).click();
          await expectDraftOutcome(page, DRAFT_READY);
          await expect(page.getByLabel("Name")).toHaveValue(NAME);
          await expect(page.getByLabel("Email")).toHaveValue(EMAIL);
        });

        await when("scheduler1 не створює картку й відкриває список клієнтів", async () => {
          // Високе вікно: кадр «Тоді» має вмістити весь список, інакше «картки немає» з кадру не підтвердити (нижня частина обрізана).
          await page.setViewportSize({ width: 1280, height: 2000 });
          await page.goto("/clients");
        });

        await thenStep(
          page,
          {
            clause: `картки «${NAME}» у списку немає: картку створює лише сам планувальник, коли зберігає форму`,
            visible: [`список клієнтів, у якому немає картки «${NAME}»`],
            hidden: [
              `кількість карток у списку така сама, як до чернетки (${cardsBefore.all})`,
              "ім'я в AC — «Client Ten»; на проді така картка вже існує (створена вручну до UAT), тому в тесті взято те саме звернення з вільним іменем",
            ],
          },
          async () => {
            await expect(page.getByTestId("viewer")).toContainText("scheduler1@example.test");
            expect(await cardCounts(page)).toEqual({ all: cardsBefore.all, named: 0 });
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
