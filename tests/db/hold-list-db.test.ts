// Список утримань планувальника (slot-holds, design.md Р15): що в ньому лишається («Held» і «Expired» зі слотом, що ще не
// почався), повторне утримання після прострочення й розклад терапевта без email клієнта. Часові межі — зсувом starts_at /
// created_at від now().
import { beforeAll, describe, expect, it } from "vitest";
import { ageHold, createSlot, ensureClient, holdAs } from "./fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let SCHEDULER: string, THERAPIST1: string;
let CLIENT1: string, CLIENT2: string, CLIENT3: string, CLIENT4: string;
const T1 = "therapist1@example.test";
const T2 = "therapist2@example.test";

beforeAll(async () => {
  t = await createTestDb();
  SCHEDULER = t.users["scheduler1@example.test"];
  THERAPIST1 = t.users[T1];
  CLIENT1 = await ensureClient(t, "client1", "client1@example.test");
  CLIENT2 = await ensureClient(t, "client2", "client2@example.test");
  CLIENT3 = await ensureClient(t, "client3", "client3@example.test");
  CLIENT4 = await ensureClient(t, "client4", "client4@example.test");
}, 60_000);

type ListRow = { hold_id: string; client_name: string; status: string; starts_at: string; held_until: string | null };
const minuteNow = async () =>
  (await t.asService<{ at: string }>("select date_trunc('minute', clock_timestamp())::text as at"))[0].at;
const holdList = (slotIds?: string[]) =>
  t.asUser<ListRow>(
    SCHEDULER,
    `select hold_id, client_name, status, starts_at, held_until from public.hold_list
     ${slotIds ? "where slot_id = any($1::uuid[])" : ""} order by starts_at, hold_id`,
    slotIds ? [slotIds] : [],
  );
// Слот, що почався: утримувати його вже не можна, тож утримання створюємо до початку й пересуваємо слот.
const startSlotAt = (slotId: string, sqlTime: string) =>
  t.asService("update public.slots set starts_at = " + sqlTime + ", ends_at = " + sqlTime + " + interval '60 minutes' where id = $1", [slotId]);

describe("Повторне утримання після прострочення", () => {
  it("AC-HOLD-37: слот знову утримано за client1 — нове «Held» на 24 години, а старе прострочене утримання client1 зникло зі списку", async () => {
    const slot = await createSlot(t, T1, "now() + interval '4 days'");
    const first = await holdAs(t, SCHEDULER, slot, CLIENT1);
    await ageHold(t, first.id!, 1500); // «Expired», слот знову вільний
    expect((await holdList([slot])).map((r) => r.status)).toEqual(["Expired"]);

    const before = await minuteNow();
    const second = await holdAs(t, SCHEDULER, slot, CLIENT1);
    const after = await minuteNow();
    expect(second.id).toBeDefined();
    const rows = await holdList([slot]);
    expect(rows.map((r) => [r.hold_id, r.status])).toEqual([[second.id, "Held"]]);
    // «Held until» — момент нового утримання (до хвилини) + 1440 хвилин, а не старого: між хвилинами до й після виклику.
    const [{ in_window }] = await t.asService<{ in_window: boolean }>(
      "select $1::timestamptz between $2::timestamptz + interval '1440 minutes' and $3::timestamptz + interval '1440 minutes' as in_window",
      [rows[0].held_until, before, after],
    );
    expect(in_window).toBe(true);
    // Старий запис не втрачено: прострочене утримання лишається в таблиці, лише не в списку.
    const [{ n }] = await t.asService<{ n: number }>("select count(*)::int as n from public.holds where slot_id = $1", [slot]);
    expect(n).toBe(2);
  });

  it("AC-HOLD-37: повторне утримання підтвердили — старе прострочене не повертається, підтверджений сеанс у списку не показано", async () => {
    const slot = await createSlot(t, T1, "now() + interval '14 days'");
    const first = await holdAs(t, SCHEDULER, slot, CLIENT3);
    await ageHold(t, first.id!, 1500);
    const second = await holdAs(t, SCHEDULER, slot, CLIENT3);
    await t.asUser(SCHEDULER, "select public.confirm_hold($1)", [second.id]);
    expect(await holdList([slot])).toEqual([]);
  });

  it("AC-HOLD-37: повторне утримання теж прострочилось — у списку один рядок (нове «Expired»), старе не повертається", async () => {
    const slot = await createSlot(t, T1, "now() + interval '15 days'");
    const first = await holdAs(t, SCHEDULER, slot, CLIENT4);
    await ageHold(t, first.id!, 3000);
    const second = await holdAs(t, SCHEDULER, slot, CLIENT4);
    await ageHold(t, second.id!, 1500);
    expect((await holdList([slot])).map((r) => [r.hold_id, r.status])).toEqual([[second.id, "Expired"]]);
  });

  it("AC-HOLD-37: слот утримав інший клієнт — прострочене утримання client1 лишається в списку (правило лише для того самого клієнта)", async () => {
    const slot = await createSlot(t, T1, "now() + interval '5 days'");
    const first = await holdAs(t, SCHEDULER, slot, CLIENT1);
    await ageHold(t, first.id!, 1500);
    const second = await holdAs(t, SCHEDULER, slot, CLIENT2);
    // Два записи на один слот: порядок між ними не задано (однаковий час слоту), тож порівнюємо за іменем.
    const rows = (await holdList([slot])).map((r) => [r.client_name, r.status]).sort();
    expect(rows).toEqual([
      ["client1", "Expired"],
      ["client2", "Held"],
    ]);
    expect(second.id).toBeDefined();
  });
});

describe("Склад і порядок списку", () => {
  it("AC-HOLD-38: лише «Held» і «Expired» за часом слоту від найближчого; підтверджені сеанси (майбутній і минулий) не показано", async () => {
    const expiredLate = await createSlot(t, T1, "now() + interval '9 days'"); // client1, «Expired»
    const heldEarly = await createSlot(t, T2, "now() + interval '7 days'"); // client2, «Held»
    const sessionFuture = await createSlot(t, T1, "now() + interval '8 days'"); // client3, «Confirmed»
    const sessionPast = await createSlot(t, T2, "now() + interval '10 days'"); // client4, «Confirmed», слот почався

    const h1 = await holdAs(t, SCHEDULER, expiredLate, CLIENT1);
    await ageHold(t, h1.id!, 1500);
    await holdAs(t, SCHEDULER, heldEarly, CLIENT2);
    const h3 = await holdAs(t, SCHEDULER, sessionFuture, CLIENT3);
    await t.asUser(SCHEDULER, "select public.confirm_hold($1)", [h3.id]);
    const h4 = await holdAs(t, SCHEDULER, sessionPast, CLIENT4);
    await t.asUser(SCHEDULER, "select public.confirm_hold($1)", [h4.id]);
    await startSlotAt(sessionPast, "now() - interval '3 hours'");

    const rows = await holdList([expiredLate, heldEarly, sessionFuture, sessionPast]);
    expect(rows.map((r) => [r.client_name, r.status])).toEqual([
      ["client2", "Held"],
      ["client1", "Expired"],
    ]);
  });

  it("AC-HOLD-42: «Held» зі слотом, що почався — у списку є за хвилину до початку, а з моменту початку немає", async () => {
    const slot = await createSlot(t, T1, "now() + interval '12 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT2);
    await startSlotAt(slot, "now() + interval '1 minute'");
    expect((await holdList([slot])).map((r) => [r.hold_id, r.status])).toEqual([[hold.id, "Held"]]);
    await startSlotAt(slot, "now()");
    expect(await holdList([slot])).toEqual([]);
    await startSlotAt(slot, "now() - interval '2 hours'");
    expect(await holdList([slot])).toEqual([]);
    // Утримання не зникло: слот лишається «Held» у розкладі, а підтвердити його вже не можна (AC-HOLD-22).
    const [board] = await t.asUser<{ status: string }>(SCHEDULER, "select status from public.slot_board where slot_id = $1", [slot]);
    expect(board.status).toBe("Held");
  });
});

describe("Розклад терапевта без email клієнта", () => {
  it("AC-HOLD-40: therapist1 бачить ім'я client1 в утриманні «Held», а email клієнта в розкладі немає ні як колонки, ні як значення", async () => {
    const slot = await createSlot(t, T1, "now() + interval '13 days'");
    await holdAs(t, SCHEDULER, slot, CLIENT1);
    const [{ id }] = await t.asService<{ id: string }>("select id from public.therapists where email = $1", [T1]);
    const rows = await t.asUser<Record<string, unknown>>(
      THERAPIST1,
      "select * from public.slots_between($1, (now() + interval '12 days')::date, (now() + interval '15 days')::date) where slot_id = $2",
      [id, slot],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "Held", client_name: "client1" });
    expect(Object.keys(rows[0]).filter((k) => /email/i.test(k))).toEqual([]);
    expect(JSON.stringify(rows[0])).not.toContain("client1@example.test");
    // Те саме для самого представлення, з якого читає розклад.
    const columns = await t.asOwner<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'slot_board' and table_schema = 'public'",
    );
    expect(columns.map((c) => c.column_name).filter((c) => /email/i.test(c))).toEqual([]);
  });
});
