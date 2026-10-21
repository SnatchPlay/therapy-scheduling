// Розклад терапевта (AC-HOLD-09, AC-HOLD-21): правила виконує RLS і security_invoker представлень, тож тут — ті самі
// запити, що робить сторінка /schedule (src/app/schedule/page.tsx), від імені терапевта.
import { beforeAll, describe, expect, it } from "vitest";
import { ageHold, createSlot, ensureClient, holdAs, practiceTime, quietDay } from "./fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let SCHEDULER: string, THERAPIST1: string, THERAPIST2: string;
const T1 = "therapist1@example.test";
const T2 = "therapist2@example.test";

beforeAll(async () => {
  t = await createTestDb();
  SCHEDULER = t.users["scheduler1@example.test"];
  THERAPIST1 = t.users[T1];
  THERAPIST2 = t.users[T2];
}, 60_000);

type Item = { hold_id: string; client_name: string; status: string; held_until: string | null };
const scheduleOf = (userId: string) =>
  t.asUser<Item>(
    userId,
    "select hold_id, client_name, status, held_until from public.hold_list order by starts_at, hold_id",
  );
const daySlots = (userId: string, therapistEmail: string, day: string) =>
  t.asUser<{ slot_id: string; status: string; client_name: string | null }>(
    userId,
    "select slot_id, status, client_name from public.day_slots((select id from public.therapists where email = $1), $2)",
    [therapistEmail, day],
  );
// Сеанс — підтверджене утримання; confirm_hold належить задачі 3, тут достатньо стану в базі.
const confirmedHold = async (slotId: string, clientId: string) => {
  const hold = await holdAs(t, SCHEDULER, slotId, clientId);
  await t.asService(`update public.holds set confirmed_at = now(), confirmed_by = $2 where id = $1`, [hold.id, SCHEDULER]);
  return hold.id!;
};

describe("Розклад терапевта", () => {
  it("AC-HOLD-09: therapist1 бачить своє утримання з client1 і «Held until», але не утримання, слоти й терапевта therapist2", async () => {
    const day = quietDay(1);
    const client1 = await ensureClient(t, "client1", "client1@example.test");
    const client2 = await ensureClient(t, "client2", "client2@example.test");
    const own = await createSlot(t, T1, practiceTime(day, "10:00"));
    const other = await createSlot(t, T2, practiceTime(day, "10:00"));
    const ownHold = await holdAs(t, SCHEDULER, own, client1);
    const otherHold = await holdAs(t, SCHEDULER, other, client2);

    const mine = await scheduleOf(THERAPIST1);
    const ownItem = mine.find((h) => h.hold_id === ownHold.id);
    expect(ownItem).toMatchObject({ client_name: "client1", status: "Held" });
    expect(ownItem?.held_until).not.toBeNull();
    expect(mine.some((h) => h.hold_id === otherHold.id)).toBe(false);

    // Слоти дня чужого терапевта порожні, навіть якщо передати його id: RLS slots.
    expect(await daySlots(THERAPIST1, T2, day)).toEqual([]);
    expect((await daySlots(THERAPIST1, T1, day)).map((s) => s.slot_id)).toEqual([own]);
    // Таблиця slots закрита власною політикою: join із therapists у day_slots її б не замінив.
    expect(await t.asUser(THERAPIST1, "select id from public.slots where id = $1", [other])).toEqual([]);
    const therapists = await t.asUser<{ email: string }>(THERAPIST1, "select email from public.therapists");
    expect(therapists).toEqual([{ email: T1 }]);

    // Клієнтів видно так само: свого — так, чужого — ні.
    const clientsSeen = async (userId: string) =>
      (await t.asUser<{ id: string }>(userId, "select id from public.clients")).map((c) => c.id);
    expect(await clientsSeen(THERAPIST1)).toContain(client1);
    expect(await clientsSeen(THERAPIST1)).not.toContain(client2);

    // Дзеркально: therapist2 бачить лише своє.
    const theirs = (await scheduleOf(THERAPIST2)).map((h) => h.hold_id);
    expect(theirs).toContain(otherHold.id);
    expect(theirs).not.toContain(ownHold.id);
  });

  it("AC-HOLD-09: «його сеанси» — підтверджене утримання лишається в розкладі після 24 годин, з ім'ям клієнта", async () => {
    const client = await ensureClient(t, "client3", "client3@example.test");
    const slot = await createSlot(t, T1, "now() + interval '12 days'");
    const holdId = await confirmedHold(slot, client);
    await ageHold(t, holdId, 3 * 1440);

    const item = (await scheduleOf(THERAPIST1)).find((h) => h.hold_id === holdId);
    expect(item).toMatchObject({ client_name: "client3", status: "Confirmed", held_until: null });
  });

  it("AC-HOLD-09: сеанс іншого терапевта не видно", async () => {
    const client = await ensureClient(t, "client4", "client4@example.test");
    const slot = await createSlot(t, T2, "now() + interval '13 days'");
    const holdId = await confirmedHold(slot, client);
    expect((await scheduleOf(THERAPIST1)).some((h) => h.hold_id === holdId)).toBe(false);
    expect((await scheduleOf(THERAPIST2)).some((h) => h.hold_id === holdId)).toBe(true);
  });

  it("AC-HOLD-21: утримання, якому 24 години 30 хвилин, у розкладі немає, а його слот показано вільним", async () => {
    const day = quietDay(2);
    const client = await ensureClient(t, "client5", "client5@example.test");
    const slot = await createSlot(t, T1, practiceTime(day, "10:00"));
    const hold = await holdAs(t, SCHEDULER, slot, client);
    await ageHold(t, hold.id!, 24 * 60 + 30);

    expect((await scheduleOf(THERAPIST1)).some((h) => h.hold_id === hold.id)).toBe(false);
    expect(await daySlots(THERAPIST1, T1, day)).toEqual([{ slot_id: slot, status: "Free", client_name: null }]);
    // Ім'я клієнта прострочене утримання теж не відкриває (RLS clients).
    expect(await t.asUser(THERAPIST1, "select 1 from public.clients where id = $1", [client])).toEqual([]);
  });

  it("AC-HOLD-21: межа — о 1439-й хвилині утримання ще в розкладі, о 1440-й — уже ні", async () => {
    const client = await ensureClient(t, "client6", "client6@example.test");
    const slot = await createSlot(t, T1, "now() + interval '14 days'");
    const hold = await holdAs(t, SCHEDULER, slot, client);
    const inSchedule = async () => (await scheduleOf(THERAPIST1)).some((h) => h.hold_id === hold.id);

    await ageHold(t, hold.id!, 1439);
    expect(await inSchedule()).toBe(true);
    await ageHold(t, hold.id!, 1440);
    expect(await inSchedule()).toBe(false);
  });
});
