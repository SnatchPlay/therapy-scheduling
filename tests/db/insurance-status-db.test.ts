// Статус перевірки страхування (insurance-status): правила виконує база — колонка з default, право update лише на неї й
// політика clients_update_insurance_staff (міграція insurance_status, ADR 0005). Мутації правил (таблиця — в описі PR)
// червонять відповідні тести.
import { beforeAll, describe, expect, it } from "vitest";
import { createSlot, ensureClient, holdAs } from "./fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let SCHEDULER: string, SCHEDULER2: string, ADMIN: string, THERAPIST1: string, THERAPIST2: string;

beforeAll(async () => {
  t = await createTestDb();
  SCHEDULER = t.users["scheduler1@example.test"];
  SCHEDULER2 = t.users["scheduler2@example.test"];
  ADMIN = t.users["admin@example.test"];
  THERAPIST1 = t.users["therapist1@example.test"];
  THERAPIST2 = t.users["therapist2@example.test"];
}, 60_000);

/** Статус картки очима користувача: undefined, якщо RLS не віддає картку. */
async function statusAs(userId: string, clientId: string) {
  const rows = await t.asUser<{ insurance_status: string }>(
    userId,
    "select insurance_status from public.clients where id = $1",
    [clientId],
  );
  return rows[0]?.insurance_status;
}

/** Як server action: update статусу від імені користувача; результат — зачеплені рядки (нуль = RLS не бачить картку). */
const setStatusAs = (userId: string, clientId: string, status: string) =>
  t.asUser<{ id: string }>(userId, "update public.clients set insurance_status = $2 where id = $1 returning id", [
    clientId,
    status,
  ]);

/** Статус в обхід RLS: підготувати стан «Дано» і перевірити, що він не змінився. */
const statusInDb = async (clientId: string) =>
  (await t.asService<{ insurance_status: string }>("select insurance_status from public.clients where id = $1", [clientId]))[0]
    .insurance_status;

const presetStatus = (clientId: string, status: string) =>
  t.asService("update public.clients set insurance_status = $2 where id = $1", [clientId, status]);

/**
 * Картка зрізу 1: без дати народження й мови. Нові такі картки база відхиляє (повнота лише на insert, міграція
 * insurance_status), тож вставляємо її, вимкнувши тригер повноти на час цього insert.
 */
async function insertLegacyCard(name: string, email: string) {
  await t.asOwner("alter table public.clients disable trigger clients_require_complete");
  try {
    const [row] = await t.asOwner<{ id: string }>(
      `insert into public.clients (full_name, email, created_by)
       values ($1, $2, (select id from public.profiles where role = 'admin' limit 1)) returning id`,
      [name, email],
    );
    return row.id;
  } finally {
    await t.asOwner("alter table public.clients enable trigger clients_require_complete");
  }
}

/** Клієнт, свій для therapist1: утримання «Held» у його майбутньому слоті. */
async function ownClientOfTherapist1(name: string, email: string) {
  const clientId = await ensureClient(t, name, email);
  const slot = await createSlot(t, "therapist1@example.test", "now() + interval '3 days'");
  expect(await holdAs(t, SCHEDULER, slot, clientId)).toHaveProperty("id");
  return clientId;
}

describe("Початковий статус", () => {
  it("AC-INS-01: картка, створена планувальником, і картка зрізу 1 (лише ім'я й email) показують «Not set»", async () => {
    await t.asUser(
      SCHEDULER,
      `insert into public.clients (full_name, email, birth_date, session_language)
       values ('Client Six', 'client6@example.test', date '1990-05-14', 'English')`,
    );
    const [created] = await t.asUser<{ id: string }>(SCHEDULER, "select id from public.clients where email = 'client6@example.test'");
    expect(await statusAs(SCHEDULER, created.id)).toBe("Not set");

    // Картка зрізу 1 (без дати народження й мови): default дає їй той самий початковий статус.
    expect(await statusAs(SCHEDULER, await insertLegacyCard("Client Old", "old1@example.test"))).toBe("Not set");
  });

  it("AC-INS-01: новою карткою не можна одразу виставити статус: insert колонки insurance_status відмовлено", async () => {
    const before = (await t.asService<{ n: number }>("select count(*)::int as n from public.clients"))[0].n;
    await expect(
      t.asUser(
        SCHEDULER,
        `insert into public.clients (full_name, email, insurance_status) values ('Client Born Verified', 'born@example.test', 'Verified')`,
      ),
    ).rejects.toMatchObject({ code: "42501" });
    expect((await t.asService<{ n: number }>("select count(*)::int as n from public.clients"))[0].n).toBe(before);
  });
});

describe("Позначення й зміна статусу (планувальник, адміністратор)", () => {
  it("AC-INS-02: scheduler1 позначає «Verified», і картка показує його й після повторного відкриття", async () => {
    const clientId = await ensureClient(t, "Client Mark", "mark@example.test");
    expect(await statusAs(SCHEDULER, clientId)).toBe("Not set");

    expect(await setStatusAs(SCHEDULER, clientId, "Verified")).toHaveLength(1);

    expect(await statusAs(SCHEDULER, clientId)).toBe("Verified");
    expect(await statusInDb(clientId)).toBe("Verified");
  });

  it("AC-INS-02: усі три значення можна позначити, і між ними можна змінювати будь-коли", async () => {
    const clientId = await ensureClient(t, "Client Cycle", "cycle@example.test");
    for (const status of ["Not accepted", "Private pay", "Verified", "Not accepted"]) {
      expect(await setStatusAs(SCHEDULER, clientId, status)).toHaveLength(1);
      expect(await statusInDb(clientId)).toBe(status);
    }
  });

  it("AC-INS-02: картці зрізу 1 без дати народження й мови теж можна позначити статус, інші дані картки не змінились", async () => {
    const clientId = await insertLegacyCard("Client Legacy", "legacy@example.test");

    expect(await setStatusAs(SCHEDULER, clientId, "Private pay")).toHaveLength(1);

    expect(await statusInDb(clientId)).toBe("Private pay");
    const [row] = await t.asService<{ birth_date: string | null; session_language: string | null }>(
      "select birth_date::text as birth_date, session_language from public.clients where id = $1",
      [clientId],
    );
    expect(row).toEqual({ birth_date: null, session_language: null });
  });

  it("AC-INS-03: admin1 змінює «Verified» на «Private pay», а scheduler2 і admin1 бачать у картці «Private pay»", async () => {
    const clientId = await ensureClient(t, "Client Seven Adult", "client7a@example.test");
    await presetStatus(clientId, "Verified");

    expect(await setStatusAs(ADMIN, clientId, "Private pay")).toHaveLength(1);

    expect(await statusAs(SCHEDULER2, clientId)).toBe("Private pay");
    expect(await statusAs(ADMIN, clientId)).toBe("Private pay");
  });

  it("AC-INS-02: повернути «Not set» не можна, і статус не змінився", async () => {
    const clientId = await ensureClient(t, "Client NoReset", "noreset@example.test");
    await presetStatus(clientId, "Verified");

    await expect(setStatusAs(SCHEDULER, clientId, "Not set")).rejects.toMatchObject({ code: "42501" });
    await expect(setStatusAs(ADMIN, clientId, "Not set")).rejects.toMatchObject({ code: "42501" });

    expect(await statusInDb(clientId)).toBe("Verified");
  });

  it("AC-INS-02: значення поза списком відхилено, і статус не змінився", async () => {
    const clientId = await ensureClient(t, "Client Bad", "badstatus@example.test");
    await presetStatus(clientId, "Verified");

    // Політика (with check) і check таблиці відмовляють по-різному за кодом: RLS — 42501, check — 23514.
    await expect(setStatusAs(SCHEDULER, clientId, "Approved")).rejects.toMatchObject({ code: "42501" });
    await expect(setStatusAs(SCHEDULER, clientId, "")).rejects.toMatchObject({ code: "42501" });
    // Остання брама для запису в обхід політики (service_role): check таблиці.
    await expect(presetStatus(clientId, "Approved")).rejects.toMatchObject({ code: "23514" });

    expect(await statusInDb(clientId)).toBe("Verified");
  });

  it("AC-INS-02: планувальник змінює лише статус: інші колонки картки недоступні для update, дані не змінились", async () => {
    const clientId = await ensureClient(t, "Client Columns", "columns@example.test");

    await expect(
      t.asUser(SCHEDULER, "update public.clients set full_name = 'Renamed' where id = $1", [clientId]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      t.asUser(SCHEDULER, "update public.clients set email = 'other@example.test' where id = $1", [clientId]),
    ).rejects.toMatchObject({ code: "42501" });

    const [row] = await t.asService<{ full_name: string; email: string }>(
      "select full_name, email from public.clients where id = $1",
      [clientId],
    );
    expect(row).toEqual({ full_name: "Client Columns", email: "columns@example.test" });
  });
});

describe("Терапевт: бачить статус своїх клієнтів, не змінює", () => {
  it("AC-INS-04: therapist1 бачить «Not accepted» у картці свого клієнта, а чужого клієнта й статусу не бачить", async () => {
    const clientId = await ownClientOfTherapist1("Client Own", "own@example.test");
    await presetStatus(clientId, "Not accepted");

    expect(await statusAs(THERAPIST1, clientId)).toBe("Not accepted");
    // Чужа картка (AC-CARD-05): нуль рядків, статус не віддано.
    expect(await statusAs(THERAPIST2, clientId)).toBeUndefined();
  });

  it("AC-INS-05: therapist1 напряму пробує змінити статус свого клієнта на «Verified», статус не змінився", async () => {
    const clientId = await ownClientOfTherapist1("Client Direct", "direct@example.test");
    await presetStatus(clientId, "Not accepted");

    // Політики на update для терапевта немає: запит не бачить жодного рядка й нічого не змінює.
    expect(await setStatusAs(THERAPIST1, clientId, "Verified")).toHaveLength(0);

    expect(await statusAs(SCHEDULER, clientId)).toBe("Not accepted");
    expect(await statusInDb(clientId)).toBe("Not accepted");
  });

  it("AC-INS-05: therapist1 не змінює статус і чужого клієнта; інші колонки теж недоступні", async () => {
    const clientId = await ownClientOfTherapist1("Client Direct Two", "direct2@example.test");
    await presetStatus(clientId, "Private pay");

    expect(await setStatusAs(THERAPIST2, clientId, "Verified")).toHaveLength(0);
    await expect(
      t.asUser(THERAPIST1, "update public.clients set full_name = 'Renamed' where id = $1", [clientId]),
    ).rejects.toMatchObject({ code: "42501" });

    expect(await statusInDb(clientId)).toBe("Private pay");
  });

  it("AC-INS-06: запит без входу (лише публічний ключ) не читає й не змінює статус", async () => {
    const clientId = await ensureClient(t, "Client Anon", "anon@example.test");
    await presetStatus(clientId, "Verified");

    await expect(t.asAnon("select insurance_status from public.clients where id = $1", [clientId])).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      t.asAnon("update public.clients set insurance_status = 'Not accepted' where id = $1", [clientId]),
    ).rejects.toMatchObject({ code: "42501" });

    expect(await statusInDb(clientId)).toBe("Verified");
  });
});

describe("Права, прочитані з бази", () => {
  it("AC-INS-02: update для authenticated — лише колонка insurance_status; anon без жодного права на clients", async () => {
    const updatable = await t.asOwner<{ grantee: string; column_name: string }>(
      `select grantee, column_name from information_schema.column_privileges
       where table_schema = 'public' and table_name = 'clients' and privilege_type = 'UPDATE'
         and grantee in ('anon', 'authenticated')
       order by grantee, column_name`,
    );
    expect(updatable).toEqual([{ grantee: "authenticated", column_name: "insurance_status" }]);

    const anon = await t.asOwner(
      "select 1 from information_schema.column_privileges where table_schema = 'public' and table_name = 'clients' and grantee = 'anon'",
    );
    expect(anon).toHaveLength(0);
  });

  it("AC-INS-05: на clients рівно одна політика update — для планувальника й адміністратора", async () => {
    const policies = await t.asOwner<{ policyname: string; roles: string }>(
      "select policyname, roles::text as roles from pg_policies where schemaname = 'public' and tablename = 'clients' and cmd = 'UPDATE'",
    );
    expect(policies).toEqual([{ policyname: "clients_update_insurance_staff", roles: "{authenticated}" }]);
  });
});
