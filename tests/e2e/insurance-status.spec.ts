// UAT: статус перевірки страхування в картці клієнта. «Тоді» — дослівно з вимог PM (requirements/33-…).
// Сценарій ПИШЕ дані (@writes): створює одну картку клієнта через форму планувальника й утримує за нею слот therapist1,
// щоб клієнт був «своїм» для терапевта; далі змінює лише статус страхування цієї картки. Картки не видаляються (права на
// delete немає), тож кожен прогін лишає одну синтетичну картку «UAT Insurance <запуск>» (*@example.test) — її й утримання
// слід назвати у звіті UAT. Без @writes (`--grep-invert '@writes'`) сценарій не запускається.
import { readFileSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ROLES, authFile, switchRole, withRole, type Role } from "./support/roles";
import { attachRuntimeErrors, given, thenStep, when } from "./support/uat";

const run = Date.now().toString(36);
const NAME = `UAT Insurance ${run}`;
const EMAIL = `uat-ins-${run}@example.test`;
let clientId = "";

test.describe.configure({ mode: "serial" });

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

const status = (page: Page) => page.getByTestId("insurance-status");

/**
 * Картка клієнта очима ролі в другій сесії: рядок «Insurance: …». Перед читанням перевіряємо, що сесія справді належить
 * очікуваному акаунту (email ролі в шапці), інакше крок «Тоді» міг би пройти від імені не тієї ролі.
 */
const statusAs = (browser: Browser, role: Role) =>
  withRole(browser, role, async (other) => {
    await other.goto(`/clients/${clientId}`);
    await expect(other.getByTestId("viewer")).toContainText(ROLES[role]);
    return (await status(other).textContent()) ?? "";
  });

/** Планувальник виставляє статус у другій сесії: «Дано» з точним статусом, як у вимозі PM (кадр «Тоді» показує його дослівно). */
const markAs = (browser: Browser, role: Role, value: string) =>
  withRole(browser, role, async (other) => {
    await other.goto(`/clients/${clientId}`);
    await other.getByLabel("Insurance status").selectOption(value);
    await other.getByRole("button", { name: "Save" }).click();
    await expect(other.locator("main").getByRole("alert")).toHaveText("Insurance status saved.");
  });

/** Планувальник створює картку дорослого клієнта через форму (початковий стан: статус ще ніхто не позначав). */
async function createClient(page: Page) {
  await page.goto("/clients/new");
  await page.getByLabel("Client type").selectOption("Adult");
  await page.getByLabel("Name").fill(NAME);
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Date of birth (YYYY-MM-DD)").fill("1990-01-01");
  await page.getByLabel("Session language").selectOption("English");
  await page.getByRole("button", { name: "Create client" }).click();
  await page.waitForURL((url) => url.pathname === "/clients");
  const link = page.getByTestId("client-card").getByRole("link", { name: NAME });
  clientId = (await link.getAttribute("href"))!.replace("/clients/", "");
}

/** Планувальник утримує перший вільний слот therapist1 за цим клієнтом: після цього клієнт «свій» для терапевта. */
async function holdSlotOfTherapist1(page: Page) {
  await page.goto("/slots");
  // Точний збіг: на проді є й «PM Therapist One» (акаунт PM), підрядок знайшов би обох.
  const therapistId = (await page.locator("#therapist option", { hasText: /^Therapist One$/ }).getAttribute("value"))!;
  for (let offset = 1; offset <= 21; offset++) {
    const day = new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    await page.goto(`/slots?therapist=${therapistId}&day=${day}&client=${encodeURIComponent(EMAIL)}`);
    const select = page.getByLabel(/^Client for /).first();
    if ((await select.count()) === 0) continue;
    // Пошук за email лишає в списку єдиного клієнта: після порожнього першого пункту.
    await select.selectOption({ index: 1 });
    await select.locator("xpath=ancestor::form").getByRole("button", { name: "Hold" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText("Slot held.");
    return;
  }
  throw new Error("немає вільного слоту therapist1 найближчі 3 тижні (передумова AC-INS-04, 05)");
}

/** Токен сесії ролі з збереженого стану входу: потрібен, щоб бити в Data API «оминаючи сторінки застосунку». */
function accessTokenOf(role: Role) {
  const { cookies } = JSON.parse(readFileSync(authFile(role), "utf8")) as { cookies: { name: string; value: string }[] };
  const chunks = cookies
    .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const raw = decodeURIComponent(chunks.map((c) => c.value).join(""));
  const json = raw.startsWith("base64-") ? Buffer.from(raw.slice("base64-".length), "base64url").toString("utf8") : raw;
  return (JSON.parse(json) as { access_token: string }).access_token;
}

test.describe("scheduler", () => {
  test.use({ storageState: authFile("scheduler") });

  test(
    "AC-INS-01: картку створено, і статус перевірки страхування ще ніхто не позначав — scheduler1 відкриває картку, в картці показано «Insurance: Not set»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-INS-01" } },
    async ({ page }) => {
      await given("картку клієнта створено, і статус перевірки страхування ще ніхто не позначав", async () => {
        await createClient(page);
        expect(clientId, "id створеної картки").toBeTruthy();
      });
      await when("scheduler1 відкриває картку клієнта", async () => {
        await page.goto(`/clients/${clientId}`);
      });
      await thenStep(
        page,
        {
          clause: "в картці показано «Insurance: Not set»",
          visible: ["рядок «Insurance: Not set» у картці клієнта"],
        },
        async () => {
          await expect(page.getByTestId("viewer")).toContainText("scheduler1@example.test");
          await expect(status(page)).toHaveText("Insurance: Not set");
        },
      );
    },
  );

  test(
    "AC-INS-02: картка показує «Insurance: Not set» — scheduler1 позначає статус «Verified», бачить «Insurance status saved.», картка показує «Insurance: Verified» і після повторного відкриття",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-INS-02" } },
    async ({ page }) => {
      await given("картка клієнта показує «Insurance: Not set»", async () => {
        await page.goto(`/clients/${clientId}`);
        await expect(status(page)).toHaveText("Insurance: Not set");
      });
      await when("scheduler1 позначає статус перевірки страхування «Verified»", async () => {
        await page.getByLabel("Insurance status").selectOption("Verified");
        await page.getByRole("button", { name: "Save" }).click();
      });
      // Кадр знімається в кінці кроку «Тоді»: повідомлення зникає після повторного відкриття картки, тож «Тоді» — два кроки.
      await thenStep(
        page,
        {
          clause: "scheduler1 бачить повідомлення «Insurance status saved.», а картка показує «Insurance: Verified»",
          visible: ["повідомлення «Insurance status saved.»", "рядок «Insurance: Verified» у картці"],
        },
        async () => {
          await expect(page.locator("main").getByRole("alert")).toHaveText("Insurance status saved.");
          await expect(status(page)).toHaveText("Insurance: Verified");
        },
      );
      await when("scheduler1 відкриває картку знову", async () => {
        await page.goto(`/clients/${clientId}`);
      });
      await thenStep(
        page,
        {
          clause: "картка показує «Insurance: Verified» і після того, як scheduler1 відкриє її знову",
          visible: ["рядок «Insurance: Verified» у повторно відкритій картці"],
        },
        async () => {
          await expect(status(page)).toHaveText("Insurance: Verified");
        },
      );
    },
  );
});

test(
  "AC-INS-03: картка показує «Insurance: Verified» — admin1 змінює статус на «Private pay», а потім scheduler2 відкриває картку; і admin1, і scheduler2 бачать «Insurance: Private pay»",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-INS-03" } },
  async ({ page, browser }) => {
    // Сторінка без збереженого входу: далі від імені admin1 (cookie сесії ролі), як switchRole в інших сценаріях.
    await switchRole(page, "admin");
    await given("картка клієнта показує «Insurance: Verified»", async () => {
      await page.goto(`/clients/${clientId}`);
      await expect(status(page)).toHaveText("Insurance: Verified");
    });
    await when("admin1 змінює статус перевірки страхування на «Private pay», а потім scheduler2 відкриває картку", async () => {
      await page.getByLabel("Insurance status").selectOption("Private pay");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.locator("main").getByRole("alert")).toHaveText("Insurance status saved.");
    });
    await thenStep(
      page,
      {
        clause: "і admin1, і scheduler2 бачать у картці «Insurance: Private pay»",
        visible: ["рядок «Insurance: Private pay» у картці (від імені admin1)"],
        hidden: ["scheduler2 у своїй сесії бачить у картці «Insurance: Private pay»"],
      },
      async () => {
        await expect(page.getByTestId("viewer")).toContainText("admin@example.test");
        await expect(status(page)).toHaveText("Insurance: Private pay");
        expect(await statusAs(browser, "scheduler2")).toBe("Insurance: Private pay");
      },
    );
  },
);

test.describe("therapist", () => {
  test.use({ storageState: authFile("therapist") });

  test(
    "AC-INS-04: client — свій клієнт therapist1, картка показує «Insurance: Not accepted» — therapist1 відкриває картку, бачить «Insurance: Not accepted», а змінити статус у картці йому не запропоновано",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-INS-04" } },
    async ({ page, browser }) => {
      await given("клієнт — свій клієнт therapist1 (утримання «Held» у його слоті), і картка показує «Insurance: Not accepted»", async () => {
        await withRole(browser, "scheduler", holdSlotOfTherapist1);
        await markAs(browser, "scheduler", "Not accepted");
        expect(await statusAs(browser, "scheduler")).toBe("Insurance: Not accepted");
      });
      await when("therapist1 відкриває картку клієнта", async () => {
        await page.goto(`/clients/${clientId}`);
      });
      await thenStep(
        page,
        {
          clause: "він бачить «Insurance: Not accepted», а змінити статус перевірки страхування в картці йому не запропоновано",
          visible: ["рядок «Insurance: Not accepted» у картці"],
          hidden: ["у картці немає ні вибору статусу, ні кнопки «Save»"],
        },
        async () => {
          await expect(page.getByTestId("viewer")).toContainText("therapist1@example.test");
          await expect(status(page)).toHaveText("Insurance: Not accepted");
          await expect(page.getByLabel("Insurance status")).toHaveCount(0);
          await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
        },
      );
    },
  );

  test(
    "AC-INS-05: therapist1 напряму, оминаючи сторінки застосунку, пробує змінити статус перевірки страхування свого клієнта на «Verified» — статус не змінився, scheduler1 у картці бачить «Insurance: Not accepted»",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-INS-05" } },
    async ({ page, request }) => {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      expect(base && key, "NEXT_PUBLIC_SUPABASE_URL і NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (публічні) для прямого запиту до Data API").toBeTruthy();

      await given("client — свій клієнт therapist1, і картка показує «Insurance: Not accepted»", async () => {
        await page.goto(`/clients/${clientId}`);
        await expect(status(page)).toHaveText("Insurance: Not accepted");
      });
      await when("therapist1 напряму, оминаючи сторінки застосунку, пробує змінити статус на «Verified»", async () => {
        // Запит до Data API з сесією терапевта: політика на update є лише в планувальника й адміністратора.
        const headers = { apikey: key!, Authorization: `Bearer ${accessTokenOf("therapist")}` };
        // Токен дійсний і це справді therapist1: той самий токен читає саме цю картку (рівно один рядок). Без цього
        // порожня відповідь PATCH могла б означати і «RLS не пропустила», і «токен протермінований / не той URL».
        const visible = await request.get(`${base}/rest/v1/clients?id=eq.${clientId}&select=id`, { headers });
        expect(visible.status(), "GET картки токеном therapist1").toBe(200);
        expect(await visible.json(), "therapist1 бачить картку свого клієнта (токен дійсний)").toEqual([{ id: clientId }]);
        // PostgREST на update, відфільтрований RLS, відповідає 200 з []: нуль зачеплених, а не помилка.
        const response = await request.patch(`${base}/rest/v1/clients?id=eq.${clientId}`, {
          headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
          data: { insurance_status: "Verified" },
        });
        expect(response.status(), "PATCH: RLS відфільтрувала рядок, а не помилка запиту").toBe(200);
        expect(await response.json(), "PATCH не зачепив жодного рядка").toEqual([]);
      });
      await thenStep(
        page,
        {
          clause: "статус не змінився: scheduler1 у картці client6 бачить «Insurance: Not accepted»",
          visible: ["рядок «Insurance: Not accepted» у картці (scheduler1)"],
          hidden: ["прямий запит терапевта не змінив жодного рядка"],
        },
        async () => {
          await switchRole(page, "scheduler");
          await page.goto(`/clients/${clientId}`);
          await expect(page.getByTestId("viewer")).toContainText("scheduler1@example.test");
          await expect(status(page)).toHaveText("Insurance: Not accepted");
        },
      );
    },
  );
});

test.describe("без входу", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test(
    "AC-INS-06: користувач не увійшов, а картка показує статус — відкриває картку за прямим посиланням, бачить лише сторінку входу, статусу й даних клієнта не показано, а scheduler1 після цього бачить той самий статус",
    { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-INS-06" } },
    async ({ page, browser }) => {
      await given("користувач не увійшов у застосунок, а картка показує «Insurance: Verified»", async () => {
        await markAs(browser, "scheduler", "Verified");
        expect(await statusAs(browser, "scheduler")).toBe("Insurance: Verified");
      });
      await when("він відкриває картку клієнта за прямим посиланням", async () => {
        await page.goto(`/clients/${clientId}`);
      });
      await thenStep(
        page,
        {
          clause:
            "він бачить лише сторінку входу, статусу страхування й інших даних клієнта не показано, а scheduler1 після цього бачить у картці «Insurance: Verified»",
          visible: ["сторінка входу (поле Email, поле Password, кнопка Sign in)"],
          hidden: ["на сторінці немає ні імені клієнта, ні email, ні рядка «Insurance: …»", "scheduler1 після цього бачить «Insurance: Verified»"],
        },
        async () => {
          await expect(page).toHaveURL(/\/login/);
          await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
          const text = await page.locator("body").innerText();
          for (const secret of [NAME, EMAIL, "Insurance"]) expect(text).not.toContain(secret);
          expect(await statusAs(browser, "scheduler")).toBe("Insurance: Verified");
        },
      );
    },
  );
});
