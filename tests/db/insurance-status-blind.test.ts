// Статус перевірки страхування клієнта (insurance-status, AC-INS-01…06), рівень бази.
// Тести написано лише з тексту AC (openspec/specs/insurance-status, requirements/33-…) і з хелперів тестів бази.
// «Insurance: <X>» у «Тоді» — значення колонки public.clients.insurance_status = <X>.
import { beforeAll, describe, expect, it } from "vitest";
import { createSlot, ensureClient, holdAs } from "./fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let ADMIN: string, SCHEDULER1: string, SCHEDULER2: string, THERAPIST1: string, THERAPIST2: string;

beforeAll(async () => {
  t = await createTestDb();
  ADMIN = t.users["admin@example.test"];
  SCHEDULER1 = t.users["scheduler1@example.test"];
  SCHEDULER2 = t.users["scheduler2@example.test"];
  THERAPIST1 = t.users["therapist1@example.test"];
  THERAPIST2 = t.users["therapist2@example.test"];
}, 60_000);

/** Статус, який бачить користувач у картці (читання від його імені, з RLS). */
async function statusSeenBy(userId: string, clientId: string): Promise<string | undefined> {
  const [row] = await t.asUser<{ insurance_status: string }>(userId, "select insurance_status from public.clients where id = $1", [clientId]);
  return row?.insurance_status;
}

/** Справжнє значення в обхід RLS — для перевірки «дані не змінилися». */
async function storedStatus(clientId: string): Promise<string> {
  const [row] = await t.asService<{ insurance_status: string }>("select insurance_status from public.clients where id = $1", [clientId]);
  return row.insurance_status;
}

/** Позначити статус від імені користувача; повертає, скільки рядків змінено, або помилку бази. */
async function markAs(userId: string, clientId: string, status: string) {
  try {
    const rows = await t.asUser<{ id: string }>(userId, "update public.clients set insurance_status = $2 where id = $1 returning id", [clientId, status]);
    return { updated: rows.length };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/** Клієнт зі стартовим статусом (підготовка даних у обхід RLS, як «Дано» у сценарії). */
async function clientWith(name: string, status?: string): Promise<string> {
  const id = await ensureClient(t, name, `${name.toLowerCase().replaceAll(" ", "")}@example.test`);
  if (status) await t.asService("update public.clients set insurance_status = $2 where id = $1", [id, status]);
  return id;
}

let slotCounter = 0;

/** «Свій клієнт терапевта»: планувальник утримує слот терапевта для клієнта. */
async function ownClientOf(therapistEmail: string, name: string, status: string): Promise<string> {
  const id = await clientWith(name, status);
  const slot = await createSlot(t, therapistEmail, `now() + interval '${2 + slotCounter++} days'`);
  expect((await holdAs(t, SCHEDULER1, slot, id)).id).toBeDefined();
  return id;
}

describe("Початковий статус", () => {
  it("AC-INS-01: картку client6 щойно створено планувальником — scheduler1 бачить «Not set»", async () => {
    await t.asUser(
      SCHEDULER1,
      "insert into public.clients (client_type, full_name, email, birth_date, session_language) values ('Adult', 'Client Six', 'client6@example.test', date '1990-05-14', 'English')",
    );
    const [card] = await t.asUser<{ id: string }>(SCHEDULER1, "select id from public.clients where email = 'client6@example.test'");
    expect(await statusSeenBy(SCHEDULER1, card.id)).toBe("Not set");
  });

  it("AC-INS-01: картка, створена поза формою (як у зрізах 1–2, без статусу), теж має «Not set»", async () => {
    const id = await ensureClient(t, "Client Legacy", "legacy-ins@example.test");
    expect(await statusSeenBy(SCHEDULER1, id)).toBe("Not set");
    expect(await statusSeenBy(ADMIN, id)).toBe("Not set");
  });
});

describe("Планувальник позначає статус", () => {
  it("AC-INS-02: scheduler1 позначає «Verified» — збережено, і після повторного читання планувальником статус «Verified»", async () => {
    const id = await clientWith("Client Six Mark");
    expect(await statusSeenBy(SCHEDULER1, id)).toBe("Not set");
    expect(await markAs(SCHEDULER1, id, "Verified")).toEqual({ updated: 1 });
    expect(await statusSeenBy(SCHEDULER1, id)).toBe("Verified");
    expect(await storedStatus(id)).toBe("Verified");
  });

  it("AC-INS-02: планувальник може позначити будь-яке з трьох значень і міняти між ними будь-коли", async () => {
    const id = await clientWith("Client Cycle");
    for (const status of ["Not accepted", "Private pay", "Verified", "Not accepted", "Verified", "Private pay"]) {
      expect(await markAs(SCHEDULER2, id, status)).toEqual({ updated: 1 });
      expect(await statusSeenBy(SCHEDULER1, id)).toBe(status);
    }
  });

  it("AC-INS-02: повернути «Not set» або записати невідоме значення не можна — статус лишається попереднім", async () => {
    const id = await clientWith("Client NoReset", "Verified");
    for (const bad of ["Not set", "Foo", "", "verified"]) {
      const result = await markAs(SCHEDULER1, id, bad);
      expect("error" in result, `значення «${bad}» має бути відхилено`).toBe(true);
      expect(await storedStatus(id)).toBe("Verified");
    }
  });
});

describe("Адміністратор змінює статус", () => {
  it("AC-INS-03: admin1 змінює «Verified» на «Private pay» — admin1 і scheduler2 бачать «Private pay»", async () => {
    const id = await clientWith("Client Seven Admin", "Verified");
    expect(await statusSeenBy(SCHEDULER2, id)).toBe("Verified");
    expect(await markAs(ADMIN, id, "Private pay")).toEqual({ updated: 1 });
    expect(await statusSeenBy(ADMIN, id)).toBe("Private pay");
    expect(await statusSeenBy(SCHEDULER2, id)).toBe("Private pay");
    expect(await storedStatus(id)).toBe("Private pay");
  });

  it("AC-INS-03: статус після зміни бачить і терапевт — але лише власного клієнта", async () => {
    const id = await ownClientOf("therapist1@example.test", "Client Seven Shared", "Verified");
    expect(await markAs(ADMIN, id, "Not accepted")).toEqual({ updated: 1 });
    expect(await statusSeenBy(THERAPIST1, id)).toBe("Not accepted");
    expect(await statusSeenBy(THERAPIST2, id)).toBeUndefined();
  });
});

describe("Терапевт: лише читання", () => {
  it("AC-INS-04: therapist1 бачить «Not accepted» у картці свого клієнта client6", async () => {
    const id = await ownClientOf("therapist1@example.test", "Client Six Own", "Not accepted");
    expect(await statusSeenBy(THERAPIST1, id)).toBe("Not accepted");
  });

  it("AC-INS-04: статус чужого клієнта (клієнт терапевта 2) терапевт 1 не бачить — картки немає в його вибірці", async () => {
    const id = await ownClientOf("therapist2@example.test", "Client Six Foreign", "Verified");
    expect(await statusSeenBy(THERAPIST1, id)).toBeUndefined();
    expect(await statusSeenBy(THERAPIST2, id)).toBe("Verified");
  });
});

describe("Терапевт в обхід сторінок", () => {
  it("AC-INS-05: планувальник може позначити статус, а therapist1 того самого клієнта — ні; статус лишається «Not accepted»", async () => {
    const id = await ownClientOf("therapist1@example.test", "Client Six Direct", "Not accepted");

    // Дозволено: планувальник змінює і повертає.
    expect(await markAs(SCHEDULER1, id, "Verified")).toEqual({ updated: 1 });
    expect(await markAs(SCHEDULER1, id, "Not accepted")).toEqual({ updated: 1 });

    // Відмовлено: терапевт — або помилка прав, або жодного зміненого рядка.
    const attempt = await markAs(THERAPIST1, id, "Verified");
    expect("error" in attempt || attempt.updated === 0, JSON.stringify(attempt)).toBe(true);

    // Дані не змінилися: у картці для scheduler1 і в самій базі.
    expect(await storedStatus(id)).toBe("Not accepted");
    expect(await statusSeenBy(SCHEDULER1, id)).toBe("Not accepted");
  });

  it("AC-INS-05: масова спроба (без умови за id) і спроба для чужого клієнта теж нічого не змінюють", async () => {
    const own = await ownClientOf("therapist1@example.test", "Client Six Bulk", "Not accepted");
    const foreign = await ownClientOf("therapist2@example.test", "Client Six Bulk Foreign", "Private pay");
    const before = await t.asService("select id, insurance_status from public.clients order by id");

    for (const target of [own, foreign]) {
      const attempt = await markAs(THERAPIST1, target, "Verified");
      expect("error" in attempt || attempt.updated === 0, JSON.stringify(attempt)).toBe(true);
    }
    const bulk = await t
      .asUser<{ id: string }>(THERAPIST1, "update public.clients set insurance_status = 'Verified' returning id")
      .then((rows) => ({ updated: rows.length }))
      .catch((error: Error) => ({ error: error.message }));
    expect("error" in bulk || bulk.updated === 0, JSON.stringify(bulk)).toBe(true);

    expect(await t.asService("select id, insurance_status from public.clients order by id")).toEqual(before);
    expect(await statusSeenBy(SCHEDULER1, own)).toBe("Not accepted");
  });

  it("AC-INS-05: терапевт не змінює статусу й іншими шляхами запису в картку (insert/delete) — дані на місці", async () => {
    const id = await ownClientOf("therapist1@example.test", "Client Six Other", "Not accepted");
    const before = await t.asService("select * from public.clients where id = $1", [id]);
    await expect(
      t.asUser(THERAPIST1, "insert into public.clients (full_name, email, insurance_status) values ('X', 'x-ins@example.test', 'Verified')"),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(t.asUser(THERAPIST1, "delete from public.clients where id = $1", [id])).rejects.toMatchObject({ code: "42501" });
    expect(await t.asService("select * from public.clients where id = $1", [id])).toEqual(before);
    expect(await t.asService("select 1 from public.clients where email = 'x-ins@example.test'")).toEqual([]);
  });
});

describe("Без входу", () => {
  it("AC-INS-06: anon не читає картки (ні статусу, ні інших даних) і не змінює статус; scheduler1 далі бачить «Verified»", async () => {
    const id = await clientWith("Client Six Anon", "Verified");

    await expect(t.asAnon("select insurance_status from public.clients where id = $1", [id])).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("select full_name, email from public.clients where id = $1", [id])).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("select * from public.clients")).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("update public.clients set insurance_status = 'Private pay' where id = $1", [id])).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("update public.clients set insurance_status = 'Private pay'")).rejects.toThrow(/permission denied/);

    expect(await storedStatus(id)).toBe("Verified");
    expect(await statusSeenBy(SCHEDULER1, id)).toBe("Verified");
  });
});
