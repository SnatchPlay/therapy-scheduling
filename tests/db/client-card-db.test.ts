// Картка клієнта з анкети й доступ до карток (client-cards, app-access): правила виконує база — обмеження, тригер і RLS
// таблиці clients (міграція client_card). Мутації правил (таблиця — в описі PR) червонять відповідні тести.
import { beforeAll, describe, expect, it } from "vitest";
import { clientErrorCode, MESSAGES, type ClientType } from "@/lib/messages";
import { addDays, practiceDate } from "@/lib/time";
import { ageHold, createSlot, holdAs, startSlotAt } from "./fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let SCHEDULER: string, SCHEDULER2: string, ADMIN: string, THERAPIST1: string, THERAPIST2: string, NEWUSER: string;

type Card = {
  type?: ClientType;
  name: string;
  email?: string | null;
  birth?: string | null;
  language?: string | null;
  guardianName?: string | null;
  guardianEmail?: string | null;
};

const insertCard = (c: Card) => ({
  sql: `insert into public.clients (client_type, full_name, email, birth_date, session_language, guardian_name, guardian_email)
        values ($1, $2, $3, $4, $5, $6, $7)`,
  params: [c.type ?? "Adult", c.name, c.email ?? null, c.birth ?? null, c.language ?? null, c.guardianName ?? null, c.guardianEmail ?? null],
});

/** Як server action: insert у clients від імені користувача; результат — "created" або текст повідомлення. */
async function createCardAs(userId: string, card: Card) {
  const { sql, params } = insertCard(card);
  try {
    await t.asUser(userId, sql, params);
    return "created";
  } catch (error) {
    return MESSAGES[clientErrorCode(error as { code?: string; message?: string }, card.type ?? "Adult")];
  }
}

const clientCount = async () =>
  (await t.asService<{ n: number }>("select count(*)::int as n from public.clients"))[0].n;

const idByName = async (fullName: string) =>
  (await t.asService<{ id: string }>("select id from public.clients where full_name = $1", [fullName]))[0].id;

/** Утримання клієнта в слоті терапевта: слот у майбутньому, утримує планувальник. */
async function holdFor(therapistEmail: string, clientId: string, offset: string) {
  const slot = await createSlot(t, therapistEmail, `now() + interval '${offset}'`);
  const hold = await holdAs(t, SCHEDULER, slot, clientId);
  expect(hold.id).toBeDefined();
  return hold.id!;
}

beforeAll(async () => {
  t = await createTestDb();
  SCHEDULER = t.users["scheduler1@example.test"];
  SCHEDULER2 = t.users["scheduler2@example.test"];
  ADMIN = t.users["admin@example.test"];
  THERAPIST1 = t.users["therapist1@example.test"];
  THERAPIST2 = t.users["therapist2@example.test"];
  NEWUSER = t.users["newuser1@example.test"];
}, 60_000);

describe("Створення картки (планувальник, адміністратор)", () => {
  it("AC-CARD-01: scheduler1 створює картку «Adult» Client Six з усіма даними, і client6 можна вибрати під час утримання", async () => {
    expect(
      await createCardAs(SCHEDULER, {
        name: "Client Six",
        email: "client6@example.test",
        birth: "1990-05-14",
        language: "English",
      }),
    ).toBe("created");
    const [card] = await t.asUser<Record<string, unknown>>(
      SCHEDULER,
      "select client_type, full_name, email, birth_date::text as birth_date, session_language from public.clients where email = 'client6@example.test'",
    );
    expect(card).toEqual({
      client_type: "Adult",
      full_name: "Client Six",
      email: "client6@example.test",
      birth_date: "1990-05-14",
      session_language: "English",
    });
    // «Можна вибрати під час утримання»: вибір показує картку, а утримання за нею проходить.
    const slot = await createSlot(t, "therapist1@example.test", "now() + interval '3 days'");
    expect(await holdAs(t, SCHEDULER, slot, await idByName("Client Six"))).toHaveProperty("id");
  });

  it("AC-CARD-01: дата народження в майбутньому — картку не створено; сьогодні за часом практики — можна", async () => {
    const before = await clientCount();
    expect(
      await createCardAs(SCHEDULER, { name: "Client Future", email: "future@example.test", birth: "2999-01-01", language: "English" }),
    ).toBe("Enter a date of birth that is not in the future.");
    expect(await clientCount()).toBe(before);
    // Межа — сьогодні в часі практики America/Los_Angeles: завтра за часом практики вже майбутнє. Підміну поясу на UTC цей
    // випадок ловить лише в годинах, коли дата UTC випереджає дату практики (PGlite не дозволяє підмінити now()).
    expect(
      await createCardAs(SCHEDULER, {
        name: "Client Tomorrow",
        email: "tomorrow@example.test",
        birth: addDays(practiceDate(new Date()), 1),
        language: "English",
      }),
    ).toBe("Enter a date of birth that is not in the future.");
    expect(
      await createCardAs(SCHEDULER, { name: "Client Today", email: "today@example.test", birth: practiceDate(new Date()), language: "English" }),
    ).toBe("created");
  });

  it("AC-CARD-01: невідома мова сеансів — картку не створено", async () => {
    expect(
      await createCardAs(SCHEDULER, { name: "Client Lang", email: "lang@example.test", birth: "1990-01-01", language: "French" }),
    ).toBe("Select a session language.");
    expect(await createCardAs(SCHEDULER, { name: "Client Lang", email: "lang@example.test", birth: "1990-01-01", language: "" })).toBe(
      "Select a session language.",
    );
  });

  it("AC-CARD-02: scheduler1 створює картку «Child» Client Seven з опікуном, а email опікуна читається поруч із клієнтом", async () => {
    expect(
      await createCardAs(SCHEDULER, {
        type: "Child",
        name: "Client Seven",
        birth: "2015-03-02",
        language: "Spanish",
        guardianName: "Guardian Seven",
        guardianEmail: "guardian7@example.test",
      }),
    ).toBe("created");
    const [card] = await t.asUser<Record<string, unknown>>(
      SCHEDULER,
      "select client_type, full_name, email, guardian_name, guardian_email from public.clients where guardian_email = 'guardian7@example.test'",
    );
    expect(card).toEqual({
      client_type: "Child",
      full_name: "Client Seven",
      email: null,
      guardian_name: "Guardian Seven",
      guardian_email: "guardian7@example.test",
    });
  });

  it("AC-CARD-02: той самий опікун у картках кількох дітей, email опікуна нормалізується", async () => {
    expect(
      await createCardAs(SCHEDULER, {
        type: "Child",
        name: "Client Ten",
        birth: "2017-06-01",
        language: "English",
        guardianName: "G. Seven",
        guardianEmail: " Guardian7@Example.TEST ",
      }),
    ).toBe("created");
    const rows = await t.asService<{ guardian_email: string }>(
      "select guardian_email from public.clients where full_name in ('Client Seven', 'Client Ten') order by full_name",
    );
    expect(rows).toEqual([{ guardian_email: "guardian7@example.test" }, { guardian_email: "guardian7@example.test" }]);
  });

  it("AC-CARD-03: дитина без імені чи email опікуна — картку не створено, повідомлення про опікуна", async () => {
    const before = await clientCount();
    const child = { type: "Child" as const, name: "Client Eight", birth: "2016-01-10", language: "English" };
    for (const guardian of [
      { guardianName: "", guardianEmail: "guardian8@example.test" },
      { guardianName: "Guardian Eight", guardianEmail: "" },
      { guardianName: "   ", guardianEmail: "guardian8@example.test" },
      { guardianName: null, guardianEmail: null },
      // Правило коректного email діє й для опікуна (припущення PM).
      { guardianName: "Guardian Eight", guardianEmail: "guardian8example.test" },
    ]) {
      expect(await createCardAs(SCHEDULER, { ...child, ...guardian })).toBe("Enter the guardian's name and a valid email.");
    }
    expect(await clientCount()).toBe(before);
  });

  it("AC-CARD-03: помилка імені дитини не згадує email, власного email у дитини немає", async () => {
    expect(
      await createCardAs(SCHEDULER, {
        type: "Child",
        name: "  ",
        birth: "2016-01-10",
        language: "English",
        guardianName: "Guardian Eight",
        guardianEmail: "guardian8@example.test",
      }),
    ).toBe("Enter the client's name.");
    // Дитина з власним email чи дорослий з опікуном — не за формою картки.
    expect(
      await createCardAs(SCHEDULER, { type: "Child", name: "Client Eight", email: "own8@example.test", guardianName: "G", guardianEmail: "g8@example.test" }),
    ).toBe("Enter the guardian's name and a valid email.");
    expect(
      await createCardAs(SCHEDULER, { name: "Client Nine", email: "client9x@example.test", guardianName: "G", guardianEmail: "g9@example.test" }),
    ).toBe("Enter the client's name and a valid email.");
  });

  it("AC-CARD-03: форма картки не пропускає дорослого без email, дитину без email опікуна й невідомий тип", async () => {
    const before = await clientCount();
    expect(await createCardAs(SCHEDULER, { name: "Client NoEmail", email: null, birth: "1990-01-01", language: "English" })).toBe(
      "Enter the client's name and a valid email.",
    );
    expect(
      await createCardAs(SCHEDULER, { type: "Child", name: "Client NoGuardianEmail", birth: "2016-01-10", language: "English", guardianName: "Guardian", guardianEmail: null }),
    ).toBe("Enter the guardian's name and a valid email.");
    await expect(
      t.asUser(SCHEDULER, "insert into public.clients (client_type, full_name, email) values ('Foo', 'Client Foo', 'foo@example.test')"),
    ).rejects.toThrow(/clients_client_type_check/);
    expect(await clientCount()).toBe(before);
  });

  it("AC-CARD-02: ім'я опікуна зберігається без пробілів по краях", async () => {
    expect(
      await createCardAs(SCHEDULER, {
        type: "Child",
        name: "Client Eleven",
        birth: "2018-04-04",
        language: "English",
        guardianName: "  Guardian Eleven  ",
        guardianEmail: "guardian11@example.test",
      }),
    ).toBe("created");
    const [row] = await t.asService<{ guardian_name: string }>("select guardian_name from public.clients where full_name = 'Client Eleven'");
    expect(row.guardian_name).toBe("Guardian Eleven");
  });

  it("AC-CARD-01: адміністратор теж створює картку (AC-HOLD-19)", async () => {
    expect(
      await createCardAs(ADMIN, { name: "Client Admin", email: "client-admin@example.test", birth: "1985-02-03", language: "Spanish" }),
    ).toBe("created");
  });

  it("AC-HOLD-39: email без крапки після «@», з двома «@», без частини до «@» чи з пробілом усередині — клієнта не створено", async () => {
    const before = await clientCount();
    for (const email of ["client3@example", "client3@@example.test", "@example.test", "client 3@example.test"]) {
      expect(await createCardAs(SCHEDULER, { name: "Client Three", email, birth: "1990-01-01", language: "English" })).toBe(
        "Enter the client's name and a valid email.",
      );
    }
    expect(await clientCount()).toBe(before);
  });

  it("AC-HOLD-41: ім'я лише з пробілів — клієнта не створено, ім'я з пробілами по краях зберігається обрізаним", async () => {
    expect(await createCardAs(SCHEDULER, { name: "   ", email: "client5@example.test", birth: "1990-01-01", language: "English" })).toBe(
      "Enter the client's name and a valid email.",
    );
    expect(await createCardAs(SCHEDULER, { name: " Client Four ", email: "client4@example.test", birth: "1990-01-01", language: "English" })).toBe("created");
    const [row] = await t.asUser<{ full_name: string }>(SCHEDULER, "select full_name from public.clients where email = 'client4@example.test'");
    expect(row.full_name).toBe("Client Four");
    expect(await t.asService("select 1 from public.clients where email = 'client5@example.test'")).toEqual([]);
  });

  it("AC-HOLD-10: після зрізу 2 клієнта створюють лише повною формою: картка лише з ім'ям і email не створюється, а повна — так", async () => {
    // Швидкої форми немає (PM, Sofiia-pm/therapy-scheduling-spec#20): ім'я й email перевіряють у повній формі.
    expect(await t.asUser(SCHEDULER, "select to_jsonb(public.client_card_errors($1::jsonb)) as e", [JSON.stringify({ client_type: "Adult", full_name: "Client Legacy", email: "legacy@example.test" })]))
      .toEqual([{ e: ["INVALID_BIRTH_DATE", "INVALID_LANGUAGE"] }]);
    // Застосунок сюди не дійде (його зупиняє функція), але база сама теж відмовляє: обмеження повноти, без свого повідомлення.
    expect(await createCardAs(SCHEDULER, { name: "Client Legacy", email: "legacy@example.test" })).toBe(MESSAGES.UNEXPECTED);
    expect(await t.asService("select 1 from public.clients where email = 'legacy@example.test'")).toEqual([]);
    expect(await createCardAs(SCHEDULER, { name: "Client Legacy", email: "legacy@example.test", birth: "1990-01-01", language: "English" })).toBe("created");
  });

  it("AC-HOLD-10: картки зрізу 1 лишаються дійсними — повноту перевіряє тригер лише на insert, а email-обмеження створено not valid", async () => {
    const rows = await t.asOwner<{ conname: string; convalidated: boolean }>(
      "select conname, convalidated from pg_constraint where conrelid = 'public.clients'::regclass and conname in ('clients_complete_check', 'clients_email_check') order by conname",
    );
    // Повнота — не обмеження таблиці (воно б перевіряло й update старого рядка), а тригер лише на insert (міграція insurance_status).
    expect(rows).toEqual([{ conname: "clients_email_check", convalidated: false }]);
    const triggers = await t.asOwner<{ tgname: string; insert_only: boolean }>(
      `select tgname, (tgtype & 4) = 4 and (tgtype & 8) = 0 and (tgtype & 16) = 0 as insert_only from pg_trigger
       where tgrelid = 'public.clients'::regclass and tgname = 'clients_require_complete'`,
    );
    expect(triggers).toEqual([{ tgname: "clients_require_complete", insert_only: true }]);
  });
});

/** Усі помилки картки за один запит (функція бази); результат — коди повідомлень у порядку полів форми. */
const errorsOf = async (userId: string, card: Record<string, string>) =>
  (await t.asUser<{ e: string[] }>(userId, "select to_jsonb(public.client_card_errors($1::jsonb)) as e", [JSON.stringify(card)]))[0].e;

const FULL_ADULT = { client_type: "Adult", full_name: "Client Nine", email: "nine@example.test", birth_date: "1990-01-01", session_language: "English" };
const FULL_CHILD = {
  client_type: "Child",
  full_name: "Client Ten",
  birth_date: "2015-03-02",
  session_language: "Spanish",
  guardian_name: "Guardian Ten",
  guardian_email: "guardian10@example.test",
};

describe("Усі помилки картки за один запит (AC-CARD-12)", () => {
  it("AC-CARD-12: дитина з порожнім ім'ям, датою народження завтра й без мови — три помилки одразу, картку не створено", async () => {
    const card = { ...FULL_CHILD, full_name: "", birth_date: addDays(practiceDate(), 1), session_language: "" };
    expect(await errorsOf(SCHEDULER, card)).toEqual(["INVALID_CLIENT_NAME", "INVALID_BIRTH_DATE", "INVALID_LANGUAGE"]);
    const before = await clientCount();
    expect(
      await createCardAs(SCHEDULER, { type: "Child", name: "", birth: card.birth_date, language: null, guardianName: "Guardian Ten", guardianEmail: "guardian10@example.test" }),
    ).not.toBe("created");
    expect(await clientCount()).toBe(before);
  });

  it("AC-CARD-12: кожне поле дає свій код, один раз на пару «ім'я й email дорослого» і на пару опікуна", async () => {
    const cases: [string, Record<string, string>, string[]][] = [
      ["повна картка дорослого", FULL_ADULT, []],
      ["повна картка дитини", FULL_CHILD, []],
      ["тип не вибрано", { ...FULL_ADULT, client_type: "" }, ["INVALID_TYPE"]],
      ["невідомий тип", { ...FULL_ADULT, client_type: "Foo" }, ["INVALID_TYPE"]],
      ["без нічого", {}, ["INVALID_TYPE", "INVALID_CLIENT_NAME", "INVALID_BIRTH_DATE", "INVALID_LANGUAGE"]],
      ["ім'я дорослого з пробілів", { ...FULL_ADULT, full_name: "   " }, ["INVALID_CLIENT"]],
      ["email дорослого без «@»", { ...FULL_ADULT, email: "nine.example.test" }, ["INVALID_CLIENT"]],
      ["ім'я й email дорослого разом — одне повідомлення", { ...FULL_ADULT, full_name: "", email: "x" }, ["INVALID_CLIENT"]],
      ["email дорослого з пробілами й великими літерами — коректний", { ...FULL_ADULT, email: "  Nine@Example.TEST " }, []],
      ["дата сьогодні коректна", { ...FULL_ADULT, birth_date: practiceDate() }, []],
      ["дата завтра", { ...FULL_ADULT, birth_date: addDays(practiceDate(), 1) }, ["INVALID_BIRTH_DATE"]],
      ["дата не у форматі РРРР-ММ-ДД", { ...FULL_ADULT, birth_date: "06.05.1990" }, ["INVALID_BIRTH_DATE"]],
      ["неіснуюча дата", { ...FULL_ADULT, birth_date: "2026-02-30" }, ["INVALID_BIRTH_DATE"]],
      ["слово замість дати", { ...FULL_ADULT, birth_date: "epoch" }, ["INVALID_BIRTH_DATE"]],
      ["мова не зі списку", { ...FULL_ADULT, session_language: "French" }, ["INVALID_LANGUAGE"]],
      ["без імені опікуна", { ...FULL_CHILD, guardian_name: " " }, ["INVALID_GUARDIAN"]],
      ["email опікуна некоректний", { ...FULL_CHILD, guardian_email: "guardian@example" }, ["INVALID_GUARDIAN"]],
      ["ім'я й email опікуна разом — одне повідомлення", { ...FULL_CHILD, guardian_name: "", guardian_email: "" }, ["INVALID_GUARDIAN"]],
      ["ім'я дитини порожнє — повідомлення без email", { ...FULL_CHILD, full_name: "" }, ["INVALID_CLIENT_NAME"]],
    ];
    for (const [name, card, expected] of cases) expect(await errorsOf(SCHEDULER, card), name).toEqual(expected);
  });

  it("AC-CARD-12: функція й обмеження таблиці згодні — картка без помилок вставляється, з помилкою — ні (правила не розходяться)", async () => {
    // «{n}» — номер варіанта: імена й email унікальні, тож дублікат не вплутується в порівняння.
    const adult = { client_type: "Adult", full_name: "Agree {n}", email: "agree{n}@example.test", birth_date: "1990-01-01", session_language: "English" };
    const child = { client_type: "Child", full_name: "Agree Child {n}", birth_date: "2015-03-02", session_language: "Spanish", guardian_name: "Guardian {n}", guardian_email: "guardian{n}@example.test" };
    const variants: Record<string, string>[] = [
      adult, child,
      { ...adult, full_name: "   " }, { ...adult, email: "x" }, { ...adult, email: "a@b" }, { ...adult, email: "a b@c.test" },
      { ...adult, email: "  Agree{n}@Example.TEST " },
      // «» — поле не заповнено (null у вставці): повноту картки тримає обмеження, а не лише обмеження мови.
      { ...adult, birth_date: "" }, { ...adult, birth_date: addDays(practiceDate(), 1) }, { ...adult, birth_date: practiceDate() },
      { ...adult, session_language: "" }, { ...adult, session_language: "French" },
      { ...child, full_name: "" }, { ...child, guardian_name: "  " }, { ...child, guardian_email: "g@x" }, { ...child, guardian_email: " G{n}@Example.TEST " },
    ];
    for (const [i, variant] of variants.entries()) {
      const card = JSON.parse(JSON.stringify(variant).replaceAll("{n}", String(i))) as Record<string, string>;
      const errors = await errorsOf(SCHEDULER, card);
      const result = await createCardAs(SCHEDULER, {
        type: card.client_type as ClientType,
        name: card.full_name,
        email: card.email ?? null,
        birth: card.birth_date || null,
        language: card.session_language || null,
        guardianName: card.guardian_name ?? null,
        guardianEmail: card.guardian_email ?? null,
      });
      expect(result === "created", JSON.stringify([card, errors, result])).toBe(errors.length === 0);
    }
  });

  it("AC-CARD-12: терапевт отримує лише CARD_FORBIDDEN, а без входу функція недоступна", async () => {
    expect(await errorsOf(THERAPIST1, {})).toEqual(["CARD_FORBIDDEN"]);
    expect(await errorsOf(THERAPIST1, FULL_ADULT)).toEqual(["CARD_FORBIDDEN"]);
    expect(await errorsOf(NEWUSER, FULL_ADULT)).toEqual(["CARD_FORBIDDEN"]); // без ролі
    expect(await errorsOf(ADMIN, FULL_ADULT)).toEqual([]);
    // Права на саму функцію: anon не виконує (а не лише відмова десь усередині), authenticated виконує.
    const [{ anon, authenticated }] = await t.asOwner<{ anon: boolean; authenticated: boolean }>(
      `select has_function_privilege('anon', 'public.client_card_errors(jsonb)', 'execute') as anon,
              has_function_privilege('authenticated', 'public.client_card_errors(jsonb)', 'execute') as authenticated`,
    );
    expect({ anon, authenticated }).toEqual({ anon: false, authenticated: true });
  });
});

describe("Дублікат картки дитини (AC-CARD-13)", () => {
  const twin = (extra: Partial<Card> = {}): Card => ({
    type: "Child",
    name: "Client Twin",
    birth: "2015-03-02",
    language: "English",
    guardianName: "Guardian Twin",
    guardianEmail: "guardian-twin@example.test",
    ...extra,
  });

  it("AC-CARD-13: та сама дитина з іншим регістром і пробілами в імені та регістром email опікуна — другу картку не створено, повідомлення PM", async () => {
    expect(await createCardAs(SCHEDULER, twin())).toBe("created");
    const before = await clientCount();
    expect(await createCardAs(SCHEDULER2, twin({ name: " client TWIN ", language: "Spanish", guardianName: "Another Name", guardianEmail: "GUARDIAN-TWIN@example.test" }))).toBe(
      "A client with these details already exists.",
    );
    expect(await clientCount()).toBe(before);
  });

  it("AC-CARD-13: близнюки з одним опікуном (інше ім'я), інша дата народження чи інший опікун — не дублікати", async () => {
    expect(await createCardAs(SCHEDULER, twin({ name: "Client Twin Two" }))).toBe("created");
    expect(await createCardAs(SCHEDULER, twin({ birth: "2016-03-02" }))).toBe("created");
    expect(await createCardAs(SCHEDULER, twin({ guardianEmail: "guardian-other@example.test" }))).toBe("created");
  });

});

describe("Доступ до карток", () => {
  let client6: string, client7: string, client9: string;

  beforeAll(async () => {
    client6 = await idByName("Client Six");
    client7 = await idByName("Client Seven");
    await createCardAs(SCHEDULER, { name: "Client Nine", email: "client9@example.test", birth: "1988-08-08", language: "English" });
    client9 = await idByName("Client Nine");
    // client6 — «Held» у therapist1, client7 — «Confirmed» у therapist1, client9 — «Held» у therapist2.
    await holdFor("therapist1@example.test", client6, "5 days");
    const confirmed = await holdFor("therapist1@example.test", client7, "6 days");
    await t.asUser(SCHEDULER, "select public.confirm_hold($1)", [confirmed]);
    await holdFor("therapist2@example.test", client9, "5 days");
  });

  const visibleTo = async (userId: string) =>
    (await t.asUser<{ id: string }>(userId, "select id from public.clients")).map((r) => r.id).sort();

  it("AC-CARD-04: therapist1 бачить картки client6 («Held») і client7 («Confirmed») з даними анкети, а client9 — ні", async () => {
    const rows = await t.asUser<Record<string, unknown>>(
      THERAPIST1,
      "select id, full_name, email, birth_date::text as birth_date, session_language, guardian_name, guardian_email from public.clients order by full_name",
    );
    const byName = Object.fromEntries(rows.map((r) => [r.full_name, r]));
    expect(Object.keys(byName)).toEqual(["Client Seven", "Client Six"]);
    expect(byName["Client Six"]).toMatchObject({ email: "client6@example.test", birth_date: "1990-05-14", session_language: "English" });
    expect(byName["Client Seven"]).toMatchObject({
      guardian_name: "Guardian Seven",
      guardian_email: "guardian7@example.test",
      birth_date: "2015-03-02",
    });
    expect(rows.map((r) => r.id)).not.toContain(client9);
  });

  it("AC-CARD-04: «Confirmed» сеанс не спливає: client7 лишається своїм і через добу після утримання", async () => {
    const [h] = await t.asService<{ id: string }>("select id from public.holds where client_id = $1", [client7]);
    await ageHold(t, h.id, 2000);
    expect(await visibleTo(THERAPIST1)).toContain(client7);
  });

  it("AC-CARD-05: therapist1 за посиланням на картку client9 не отримує жодного рядка, і картка не змінилася", async () => {
    const before = await t.asService("select * from public.clients where id = $1", [client9]);
    expect(await t.asUser(THERAPIST1, "select * from public.clients where id = $1", [client9])).toEqual([]);
    // Прямий запис чужої картки через Data API: немає прав на update (крім статусу страхування, ADR 0005) і на delete.
    await expect(t.asUser(THERAPIST1, "update public.clients set full_name = 'X' where id = $1", [client9])).rejects.toThrow(/permission denied/);
    await expect(t.asUser(THERAPIST1, "delete from public.clients where id = $1", [client9])).rejects.toThrow(/permission denied/);
    expect(await t.asService("select * from public.clients where id = $1", [client9])).toEqual(before);
  });

  it("AC-CARD-06: therapist1 пробує створити картку — відмова, кількість карток не змінилася", async () => {
    const before = await clientCount();
    expect(await createCardAs(THERAPIST1, { name: "Client Nope", email: "nope@example.test", birth: "1990-01-01", language: "English" })).toBe(
      "Only schedulers and admins can create client cards.",
    );
    expect(await clientCount()).toBe(before);
  });

  it("AC-CARD-07: без входу (anon) картки й утримання не видно, записати нічого не можна", async () => {
    const before = await clientCount();
    await expect(t.asAnon("select id from public.clients")).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("select hold_id from public.hold_list")).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("update public.clients set full_name = 'X'")).rejects.toThrow(/permission denied/);
    await expect(t.asAnon(insertCard({ name: "Anon", email: "anon@example.test" }).sql, insertCard({ name: "Anon", email: "anon@example.test" }).params)).rejects.toThrow(/permission denied/);
    expect(await clientCount()).toBe(before);
  });

  it("AC-CARD-08: «Expired» утримання client6 у therapist1 — картки немає ні в списку, ні за посиланням", async () => {
    const lone = await createCardAs(SCHEDULER, { name: "Client Lapsed", email: "lapsed@example.test", birth: "1991-01-01", language: "English" });
    expect(lone).toBe("created");
    const lapsed = await idByName("Client Lapsed");
    const hold = await holdFor("therapist1@example.test", lapsed, "7 days");
    // Межа 24 годин, як AC-HOLD-05/06: за хвилину до кінця клієнт ще свій, на межі вже ні.
    await ageHold(t, hold, 1439);
    expect(await visibleTo(THERAPIST1)).toContain(lapsed);
    await ageHold(t, hold, 1440);
    expect(await visibleTo(THERAPIST1)).not.toContain(lapsed);
    expect(await t.asUser(THERAPIST1, "select * from public.clients where id = $1", [lapsed])).toEqual([]);
  });

  it("AC-CARD-14: «Held» робить клієнта своїм до початку слоту — за хвилину до початку ще свій, з початку (включно) вже ні, за посиланням відмова", async () => {
    expect(await createCardAs(SCHEDULER, { name: "Client Started", email: "started@example.test", birth: "1992-02-02", language: "English" })).toBe("created");
    const started = await idByName("Client Started");
    const slot = await createSlot(t, "therapist1@example.test", "now() + interval '9 days'");
    expect((await holdAs(t, SCHEDULER, slot, started)).id).toBeDefined();

    await startSlotAt(t, slot, "now() + interval '1 minute'");
    expect(await visibleTo(THERAPIST1)).toContain(started);
    await startSlotAt(t, slot, "now()");
    expect(await visibleTo(THERAPIST1)).not.toContain(started);
    expect(await t.asUser(THERAPIST1, "select * from public.clients where id = $1", [started])).toEqual([]);
    await startSlotAt(t, slot, "now() - interval '2 hours'");
    expect(await visibleTo(THERAPIST1)).not.toContain(started);
  });

  it("AC-CARD-14: «Confirmed» без обмеження в часі — слот сеансу почався місяць тому, а клієнт лишається своїм", async () => {
    expect(await createCardAs(SCHEDULER, { name: "Client Past", email: "past@example.test", birth: "1994-04-04", language: "English" })).toBe("created");
    const past = await idByName("Client Past");
    const slot = await createSlot(t, "therapist1@example.test", "now() + interval '12 days'");
    const hold = await holdAs(t, SCHEDULER, slot, past);
    await t.asUser(SCHEDULER, "select public.confirm_hold($1)", [hold.id]);
    await startSlotAt(t, slot, "now() - interval '30 days'");
    expect(await visibleTo(THERAPIST1)).toContain(past);
  });

  it("AC-CARD-14: інше утримання «Held» із майбутнім слотом тримає клієнта своїм, навіть коли слот першого вже почався", async () => {
    expect(await createCardAs(SCHEDULER, { name: "Client Both", email: "both@example.test", birth: "1993-03-03", language: "English" })).toBe("created");
    const both = await idByName("Client Both");
    const first = await createSlot(t, "therapist1@example.test", "now() + interval '10 days'");
    const second = await createSlot(t, "therapist1@example.test", "now() + interval '11 days'");
    expect((await holdAs(t, SCHEDULER, first, both)).id).toBeDefined();
    expect((await holdAs(t, SCHEDULER, second, both)).id).toBeDefined();
    await startSlotAt(t, first, "now()");
    expect(await visibleTo(THERAPIST1)).toContain(both);
    // Інший час, ніж у першого слоту: початок слоту терапевта унікальний, а два now() можуть збігтися.
    await startSlotAt(t, second, "now() - interval '1 hour'");
    expect(await visibleTo(THERAPIST1)).not.toContain(both);
  });

  it("AC-CARD-09: therapist2 без «Held» і «Confirmed» бачить порожній список клієнтів", async () => {
    // У therapist2 лише client9 («Held»); після прострочення — жодного.
    const [h] = await t.asService<{ id: string }>("select h.id from public.holds as h where h.client_id = $1", [client9]);
    await ageHold(t, h.id, 1440);
    expect(await visibleTo(THERAPIST2)).toEqual([]);
  });

  it("AC-CARD-10: scheduler2 і admin1 бачать усі картки, а в картці client7 — дані опікуна", async () => {
    const all = (await t.asService<{ id: string }>("select id from public.clients")).map((r) => r.id).sort();
    expect(await visibleTo(SCHEDULER2)).toEqual(all);
    expect(await visibleTo(ADMIN)).toEqual(all);
    const [card] = await t.asUser<{ guardian_name: string; guardian_email: string }>(
      SCHEDULER2,
      "select guardian_name, guardian_email from public.clients where id = $1",
      [client7],
    );
    expect(card).toEqual({ guardian_name: "Guardian Seven", guardian_email: "guardian7@example.test" });
  });

  it("AC-CARD-11: newuser1 без ролі не має карток, не створює їх і не змінює", async () => {
    expect(await t.asService("select role from public.profiles where id = $1", [NEWUSER])).toEqual([{ role: null }]);
    const before = await clientCount();
    expect(await visibleTo(NEWUSER)).toEqual([]);
    expect(await t.asUser(NEWUSER, "select hold_id from public.hold_list")).toEqual([]);
    expect(await createCardAs(NEWUSER, { name: "Client Nobody", email: "nobody@example.test", birth: "1990-01-01", language: "English" })).toBe(
      "Only schedulers and admins can create client cards.",
    );
    await expect(t.asUser(NEWUSER, "update public.clients set full_name = 'X' where id = $1", [client6])).rejects.toThrow(/permission denied/);
    expect(await clientCount()).toBe(before);
  });

  it("AC-CARD-11: новий користувач Auth без ролі отримує role = null (тригер профілю), а не therapist", async () => {
    const id = await t.createAuthUser("newcomer@example.test");
    expect(await t.asService("select role from public.profiles where id = $1", [id])).toEqual([{ role: null }]);
    expect(await t.asUser(id, "select id from public.clients")).toEqual([]);
  });

  it("права на колонки: автора картки не підробити, INSERT лише на колонки картки, UPDATE лише статус страхування (ADR 0005), DELETE немає", async () => {
    await expect(
      t.asUser(SCHEDULER, "insert into public.clients (full_name, email, created_by) values ('X', 'x@example.test', $1)", [ADMIN]),
    ).rejects.toThrow(/permission denied/);
    const grants = await t.asOwner<{ privilege_type: string; column_name: string }>(
      `select privilege_type, column_name from information_schema.column_privileges
       where table_name = 'clients' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE') order by 2, 1`,
    );
    // Єдина колонка з update — статус страхування (міграція insurance_status); решту картки не редагують до WS11.
    expect(grants.filter((g) => g.privilege_type === "UPDATE").map((g) => g.column_name)).toEqual(["insurance_status"]);
    expect(grants.filter((g) => g.privilege_type === "INSERT").map((g) => g.column_name)).toEqual([
      "birth_date",
      "client_type",
      "email",
      "full_name",
      "guardian_email",
      "guardian_name",
      "session_language",
    ]);
  });
});
