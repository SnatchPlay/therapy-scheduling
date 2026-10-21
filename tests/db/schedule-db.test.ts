// Розклад терапевта (AC-HOLD-30, 31, 09, 21): правила виконує RLS і security_invoker представлень, тож тут — той самий
// запит, що робить сторінка /schedule (public.slots_between за тиждень, src/app/schedule/page.tsx), від імені терапевта.
import { beforeAll, describe, expect, it } from "vitest";
import { addDays } from "@/lib/time";
import { ageHold, createSlot, ensureClient, holdAs, practiceTime, quietDay } from "./fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let SCHEDULER: string, THERAPIST1: string, THERAPIST2: string;
let ID1: string, ID2: string; // id рядків therapists: передаємо як параметр, а не підзапитом від імені терапевта (RLS дала б NULL)
const T1 = "therapist1@example.test";
const T2 = "therapist2@example.test";

beforeAll(async () => {
  t = await createTestDb();
  SCHEDULER = t.users["scheduler1@example.test"];
  THERAPIST1 = t.users[T1];
  THERAPIST2 = t.users[T2];
  [ID1, ID2] = (
    await t.asService<{ id: string }>("select id from public.therapists where email in ($1, $2) order by email", [T1, T2])
  ).map((r) => r.id);
}, 60_000);

// Окремий тиждень на тест: понеділок після неділі без початкових слотів (сид — лише будні, щонайменше за 400 днів).
let weeks = 0;
// Крок у три тижні: тест створює слоти й у наступному тижні (понеділок + 10 днів).
const mondayOfNewWeek = () => addDays(quietDay(3 * weeks++), 1);

type Item = { slot_id: string; starts_at: string; status: string; client_name: string | null; held_until: string | null };
const weekOf = (userId: string, therapistEmail: string, monday: string) =>
  t.asUser<Item>(
    userId,
    `select slot_id, starts_at, status, client_name, held_until from public.slots_between($1, $2, $3)`,
    [therapistEmail === T1 ? ID1 : ID2, monday, addDays(monday, 7)],
  );
// Сеанс — підтверджене утримання.
const confirmedHold = async (slotId: string, clientId: string) => {
  const hold = await holdAs(t, SCHEDULER, slotId, clientId);
  await t.asUser(SCHEDULER, "select public.confirm_hold($1)", [hold.id]);
  return hold.id!;
};
const statusOf = (rows: Item[], slotId: string) => rows.find((r) => r.slot_id === slotId)?.status;

describe("Розклад терапевта на тиждень", () => {
  it("AC-HOLD-30: тиждень пн–нд — сеанс у понеділок «Confirmed», утримання в п'ятницю «Held», слоти 11:00 і 12:00 вільні; сеансу наступного тижня немає", async () => {
    const monday = mondayOfNewWeek();
    const client1 = await ensureClient(t, "client1", "client1@example.test");
    const session = await createSlot(t, T1, practiceTime(monday, "10:00"));
    const friday = addDays(monday, 4);
    const held = await createSlot(t, T1, practiceTime(friday, "10:00"));
    const free11 = await createSlot(t, T1, practiceTime(friday, "11:00"));
    const free12 = await createSlot(t, T1, practiceTime(friday, "12:00"));
    const nextWeek = await createSlot(t, T1, practiceTime(addDays(monday, 10), "10:00"));
    await confirmedHold(session, client1);
    const client2 = await ensureClient(t, "client2", "client2@example.test");
    await holdAs(t, SCHEDULER, held, client2);
    await confirmedHold(nextWeek, client1); // сеанс наступного тижня: у цьому тижні його немає

    const rows = await weekOf(THERAPIST1, T1, monday);
    expect(rows.map((r) => [r.slot_id, r.status])).toEqual([
      [session, "Confirmed"],
      [held, "Held"],
      [free11, "Free"],
      [free12, "Free"],
    ]);
    expect(rows[0].client_name).toBe("client1");
    expect(rows[1]).toMatchObject({ client_name: "client2" });
    expect(rows[1].held_until).not.toBeNull();
    expect(rows[0].held_until).toBeNull();
    expect(rows.some((r) => r.slot_id === nextWeek)).toBe(false);
  });

  it("AC-HOLD-31: наступний тиждень показує сеанс четверга зі статусом «Confirmed»", async () => {
    const monday = mondayOfNewWeek();
    const client = await ensureClient(t, "client3", "client3@example.test");
    const thursdayNext = await createSlot(t, T1, practiceTime(addDays(monday, 10), "10:00"));
    await confirmedHold(thursdayNext, client);

    expect(await weekOf(THERAPIST1, T1, monday)).toEqual([]);
    const next = await weekOf(THERAPIST1, T1, addDays(monday, 7));
    expect(next.map((r) => [r.slot_id, r.status, r.client_name])).toEqual([[thursdayNext, "Confirmed", "client3"]]);
  });

  it("AC-HOLD-30: межі тижня — понеділок 00:00 у тижні, наступний понеділок 00:00 уже в наступному (час практики)", async () => {
    const monday = mondayOfNewWeek();
    const first = await createSlot(t, T1, practiceTime(monday, "00:00"));
    const last = await createSlot(t, T1, practiceTime(addDays(monday, 6), "23:00"));
    const nextFirst = await createSlot(t, T1, practiceTime(addDays(monday, 7), "00:00"));
    const rows = await weekOf(THERAPIST1, T1, monday);
    expect(rows.map((r) => r.slot_id)).toEqual([first, last]);
    expect((await weekOf(THERAPIST1, T1, addDays(monday, 7))).map((r) => r.slot_id)).toEqual([nextFirst]);
  });

  it("AC-HOLD-09: therapist1 бачить своє утримання з client1 і «Held until», але не утримання, слоти й терапевта therapist2", async () => {
    const monday = mondayOfNewWeek();
    const client1 = await ensureClient(t, "client8", "client8@example.test");
    const client2 = await ensureClient(t, "client9", "client9@example.test");
    const own = await createSlot(t, T1, practiceTime(monday, "10:00"));
    const other = await createSlot(t, T2, practiceTime(monday, "10:00"));
    await holdAs(t, SCHEDULER, own, client1);
    await holdAs(t, SCHEDULER, other, client2);

    const mine = await weekOf(THERAPIST1, T1, monday);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ slot_id: own, status: "Held", client_name: "client8" });
    expect(mine[0].held_until).not.toBeNull();
    // Слоти й розклад чужого терапевта порожні, навіть коли передати його id: RLS slots (функція — security invoker).
    expect(await weekOf(THERAPIST1, T2, monday)).toEqual([]);
    // Таблиця slots закрита власною політикою: join із therapists у slot_board її б не замінив.
    expect(await t.asUser(THERAPIST1, "select id from public.slots where id = $1", [other])).toEqual([]);
    expect(await t.asUser<{ email: string }>(THERAPIST1, "select email from public.therapists")).toEqual([{ email: T1 }]);
    // Клієнтів видно так само: свого — так, чужого — ні.
    const clients = (await t.asUser<{ id: string }>(THERAPIST1, "select id from public.clients")).map((c) => c.id);
    expect(clients).toContain(client1);
    expect(clients).not.toContain(client2);

    // Дзеркально: therapist2 бачить лише своє.
    const theirs = await weekOf(THERAPIST2, T2, monday);
    expect(theirs.map((r) => r.slot_id)).toEqual([other]);
  });

  it("AC-HOLD-09: «його сеанси» — підтверджене утримання лишається в розкладі після 24 годин, з ім'ям клієнта", async () => {
    const monday = mondayOfNewWeek();
    const client = await ensureClient(t, "client4", "client4@example.test");
    const slot = await createSlot(t, T1, practiceTime(monday, "10:00"));
    const holdId = await confirmedHold(slot, client);
    await ageHold(t, holdId, 3 * 1440);

    expect(await weekOf(THERAPIST1, T1, monday)).toMatchObject([
      { slot_id: slot, status: "Confirmed", client_name: "client4", held_until: null },
    ]);
  });

  it("AC-HOLD-09: сеанс іншого терапевта не видно", async () => {
    const monday = mondayOfNewWeek();
    const client = await ensureClient(t, "client5", "client5@example.test");
    const slot = await createSlot(t, T2, practiceTime(monday, "10:00"));
    await confirmedHold(slot, client);
    expect(await weekOf(THERAPIST1, T2, monday)).toEqual([]);
    expect(statusOf(await weekOf(THERAPIST2, T2, monday), slot)).toBe("Confirmed");
  });

  it("AC-HOLD-21: утримання, якому 24 години 30 хвилин, у розкладі не показано, а його слот показано вільним", async () => {
    const monday = mondayOfNewWeek();
    const client = await ensureClient(t, "client6", "client6@example.test");
    const slot = await createSlot(t, T1, practiceTime(addDays(monday, 2), "10:00"));
    const hold = await holdAs(t, SCHEDULER, slot, client);
    await ageHold(t, hold.id!, 24 * 60 + 30);

    expect(await weekOf(THERAPIST1, T1, monday)).toEqual([
      expect.objectContaining({ slot_id: slot, status: "Free", client_name: null, held_until: null }),
    ]);
    // Ім'я клієнта прострочене утримання теж не відкриває (RLS clients).
    expect(await t.asUser(THERAPIST1, "select 1 from public.clients where id = $1", [client])).toEqual([]);
  });

  it("AC-HOLD-21: межа — о 1439-й хвилині утримання ще в розкладі «Held», о 1440-й — слот «Free»", async () => {
    const monday = mondayOfNewWeek();
    const client = await ensureClient(t, "client7", "client7@example.test");
    const slot = await createSlot(t, T1, practiceTime(addDays(monday, 3), "10:00"));
    const hold = await holdAs(t, SCHEDULER, slot, client);

    await ageHold(t, hold.id!, 1439);
    expect(statusOf(await weekOf(THERAPIST1, T1, monday), slot)).toBe("Held");
    await ageHold(t, hold.id!, 1440);
    expect(statusOf(await weekOf(THERAPIST1, T1, monday), slot)).toBe("Free");
  });
});

describe("Межі тижня на переході літнього/зимового часу (America/Los_Angeles)", () => {
  // Фіксовані тижні, а не quietDay: дати 400 днів уперед з часом потрапляють у різні сезони. 2026-11-01 — кінець
  // літнього часу (тиждень 169 годин), 2027-03-14 — початок (167). Північ понеділка й 23:00 неділі — всередині, наступна
  // північ — зовні, хоч би що був зсув UTC.
  it.each(["2026-10-26", "2027-03-08"])("AC-HOLD-30: тиждень з понеділка %s — слоти 00:00 понеділка й 23:00 неділі всередині, 00:00 наступного понеділка ні", async (monday) => {
    const first = await createSlot(t, T1, practiceTime(monday, "00:00"));
    const last = await createSlot(t, T1, practiceTime(addDays(monday, 6), "23:00"));
    const nextFirst = await createSlot(t, T1, practiceTime(addDays(monday, 7), "00:00"));
    const ids = (await weekOf(THERAPIST1, T1, monday)).map((r) => r.slot_id);
    expect(ids[0]).toBe(first);
    expect(ids.at(-1)).toBe(last);
    expect(ids).not.toContain(nextFirst);
  });
});

describe("Слоти за діапазон днів", () => {
  it("day_slots — діапазон з одного дня: ті самі слоти, що й slots_between за цей день", async () => {
    const monday = mondayOfNewWeek();
    const a = await createSlot(t, T1, practiceTime(monday, "09:00"));
    await createSlot(t, T1, practiceTime(addDays(monday, 1), "09:00"));
    const day = await t.asUser<{ slot_id: string }>(
      SCHEDULER,
      "select slot_id from public.day_slots((select id from public.therapists where email = $1), $2)",
      [T1, monday],
    );
    expect(day.map((r) => r.slot_id)).toEqual([a]);
  });

  it("анонім не викликає slots_between: revoke execute від public і anon", async () => {
    await expect(t.asAnon("select * from public.slots_between($1, '2027-01-04', '2027-01-11')", [ID1])).rejects.toThrow(
      /permission denied for function slots_between/,
    );
  });
});
