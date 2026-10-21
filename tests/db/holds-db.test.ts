// Утримання слоту (slot-holds): правила виконує база — тригер private.guard_new_hold, hold_slot, slot_board, RLS.
// Межі часу перевіряємо зсувом created_at / starts_at від now() на точні хвилини.
import { beforeAll, describe, expect, it } from "vitest";
import { MESSAGES } from "@/lib/messages";
import { hasHoldableSlot } from "@/lib/slots";
import { ageHold, boardOf, createSlot, ensureClient, holdAs, practiceTime } from "./fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let SCHEDULER: string, SCHEDULER2: string, ADMIN: string, THERAPIST: string;
let CLIENT1: string, CLIENT2: string;
const T1 = "therapist1@example.test";

beforeAll(async () => {
  t = await createTestDb();
  SCHEDULER = t.users["scheduler1@example.test"];
  SCHEDULER2 = t.users["scheduler2@example.test"];
  ADMIN = t.users["admin@example.test"];
  THERAPIST = t.users["therapist1@example.test"];
  CLIENT1 = await ensureClient(t, "client1", "client1@example.test");
  CLIENT2 = await ensureClient(t, "client2", "client2@example.test");
}, 60_000);

const activeHolds = async (slotId: string) => {
  const [{ n }] = await t.asUser<{ n: number }>(
    SCHEDULER,
    "select count(*)::int as n from public.hold_list where slot_id = $1 and status <> 'Expired'",
    [slotId],
  );
  return n;
};

describe("Слоти дня", () => {
  it("AC-HOLD-01: вільний, «Held» і «Confirmed» слоти дня; утримати можна лише вільний", async () => {
    const day = "2027-03-02";
    const s10 = await createSlot(t, T1, practiceTime(day, "10:00"));
    const s11 = await createSlot(t, T1, practiceTime(day, "11:00"));
    const s12 = await createSlot(t, T1, practiceTime(day, "12:00"));
    await holdAs(t, SCHEDULER, s11, CLIENT1);
    const held12 = await holdAs(t, SCHEDULER, s12, CLIENT2);
    await t.asService("update public.holds set confirmed_at = now() where id = $1", [held12.id]);

    const rows = await t.asUser<{ slot_id: string; status: string; holdable: boolean }>(
      SCHEDULER,
      "select slot_id, status, holdable from public.day_slots((select id from public.therapists where email = $1), $2)",
      [T1, day],
    );
    expect(rows).toEqual([
      { slot_id: s10, status: "Free", holdable: true },
      { slot_id: s11, status: "Held", holdable: false },
      { slot_id: s12, status: "Confirmed", holdable: false },
    ]);
  });

  it("AC-HOLD-18: слоти 10:00 «Held» і 11:00 «Confirmed», вільних немає — повідомлення й обидва слоти зі статусами", async () => {
    const day = "2027-03-03";
    const s10 = await createSlot(t, T1, practiceTime(day, "10:00"));
    const s11 = await createSlot(t, T1, practiceTime(day, "11:00"));
    await holdAs(t, SCHEDULER, s10, CLIENT1);
    const held11 = await holdAs(t, SCHEDULER, s11, CLIENT2);
    await t.asService("update public.holds set confirmed_at = now() where id = $1", [held11.id]);
    const rows = await t.asUser<{ slot_id: string; status: string; holdable: boolean }>(
      SCHEDULER,
      "select slot_id, status, holdable from public.day_slots((select id from public.therapists where email = $1), $2)",
      [T1, day],
    );
    expect(rows).toEqual([
      { slot_id: s10, status: "Held", holdable: false },
      { slot_id: s11, status: "Confirmed", holdable: false },
    ]);
    expect(hasHoldableSlot(rows)).toBe(false);
    expect(MESSAGES.NO_FREE_SLOTS).toBe("No free slots on this day.");
  });

  it("AC-HOLD-24: у день без жодного слоту — лише «No free slots on this day.» і жодного слоту", async () => {
    const rows = await t.asUser<{ holdable: boolean }>(
      SCHEDULER,
      "select holdable from public.day_slots((select id from public.therapists where email = $1), '2027-03-06')",
      [T1],
    );
    expect(rows).toEqual([]);
    expect(hasHoldableSlot(rows)).toBe(false);
  });
});

describe("Утримання", () => {
  it("AC-HOLD-02: утримання вільного слоту — «Held», client1, Held until через 24 години; більше ніхто не бачить слот вільним", async () => {
    const slot = await createSlot(t, T1, "now() + interval '3 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    expect(hold.id).toBeDefined();

    // Значення, яке бачить планувальник (slot_board.held_until), рівно на 1440 хвилин пізніше за створення.
    const [h] = await t.asUser<{ minutes: number }>(
      SCHEDULER,
      `select extract(epoch from (b.held_until - x.created_at))::int / 60 as minutes
       from public.slot_board b join public.hold_list x on x.hold_id = b.hold_id where b.slot_id = $1`,
      [slot],
    );
    expect(h.minutes).toBe(1440);
    for (const user of [SCHEDULER, SCHEDULER2, ADMIN, THERAPIST]) {
      const row = await boardOf(t, user, slot);
      expect(row).toMatchObject({ status: "Held", client_name: "client1", holdable: false });
      expect(row?.held_until).not.toBeNull();
    }
  });

  it("AC-HOLD-03: слот уже утримано за client1 — інший планувальник не утримує його за client2", async () => {
    const slot = await createSlot(t, T1, "now() + interval '4 days'");
    await holdAs(t, SCHEDULER, slot, CLIENT1);
    expect(await holdAs(t, SCHEDULER2, slot, CLIENT2)).toEqual({ message: "This slot is no longer available." });
    expect(await activeHolds(slot)).toBe(1);
  });

  it("AC-HOLD-04: дві спроби двох планувальників на один вільний слот — рівно одне утримання", async () => {
    // PGlite — одне з'єднання, тож спроби йдуть по черзі; у Postgres їх серіалізує блокування рядка слоту (for update).
    const slot = await createSlot(t, T1, "now() + interval '5 days'");
    const results = [await holdAs(t, SCHEDULER, slot, CLIENT1), await holdAs(t, SCHEDULER2, slot, CLIENT2)];
    expect(results.filter((r) => r.id)).toHaveLength(1);
    expect(results.filter((r) => r.message === "This slot is no longer available.")).toHaveLength(1);
    expect(await activeHolds(slot)).toBe(1);
  });

  it("AC-HOLD-07: слот почався 5 хвилин тому — утримання не створюється", async () => {
    const slot = await createSlot(t, T1, "now() - interval '5 minutes'");
    expect(await holdAs(t, SCHEDULER, slot, CLIENT1)).toEqual({
      message: "This slot has already started and cannot be held.",
    });
    expect(await activeHolds(slot)).toBe(0);
  });

  it("AC-HOLD-08: терапевт не утримує слот", async () => {
    const slot = await createSlot(t, T1, "now() + interval '6 days'");
    expect(await holdAs(t, THERAPIST, slot, CLIENT1)).toEqual({ message: "Only schedulers and admins can hold slots." });
    // Прямий insert через Data API теж не проходить (RLS).
    await expect(
      t.asUser(THERAPIST, "insert into public.holds (slot_id, client_id) values ($1, $2)", [slot, CLIENT1]),
    ).rejects.toThrow(/row-level security/);
    expect(await activeHolds(slot)).toBe(0);
  });

  it("AC-HOLD-17: повторне утримання за тим самим client1 — нового немає, Held until не змінюється", async () => {
    const slot = await createSlot(t, T1, "now() + interval '7 days'");
    const first = await holdAs(t, SCHEDULER, slot, CLIENT1);
    const before = await boardOf(t, SCHEDULER, slot);
    expect(await holdAs(t, SCHEDULER, slot, CLIENT1)).toEqual({ message: "This slot is no longer available." });
    const after = await boardOf(t, SCHEDULER, slot);
    expect(after?.held_until).toEqual(before?.held_until);
    const [{ n }] = await t.asService<{ n: number }>("select count(*)::int as n from public.holds where slot_id = $1", [
      slot,
    ]);
    expect(n).toBe(1);
    expect(first.id).toBeDefined();
  });
});

describe("Без входу (anon)", () => {
  it("не читає слоти, утримання й представлення та не викликає функції утримання", async () => {
    for (const sql of [
      "select id from public.therapists",
      "select id from public.slots",
      "select id from public.holds",
      "select slot_id from public.slot_board",
      "select hold_id from public.hold_list",
      "select * from public.day_slots(gen_random_uuid(), '2027-03-02')",
      "select public.hold_slot(gen_random_uuid(), gen_random_uuid())",
    ]) {
      await expect(t.asAnon(sql), sql).rejects.toThrow(/permission denied/);
    }
  });
});

describe("Прострочення утримання", () => {
  it("AC-HOLD-05: через 1439 хвилин (за хвилину до кінця) слот досі «Held»", async () => {
    const slot = await createSlot(t, T1, "now() + interval '8 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    await ageHold(t, hold.id!, 1439);
    expect(await boardOf(t, SCHEDULER, slot)).toMatchObject({ status: "Held", holdable: false });
  });

  it("AC-HOLD-06: через 1440 хвилин утримання «Expired», слот вільний і його утримують за іншим клієнтом", async () => {
    const slot = await createSlot(t, T1, "now() + interval '9 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    await ageHold(t, hold.id!, 1440);

    const [listed] = await t.asUser<{ status: string }>(SCHEDULER, "select status from public.hold_list where hold_id = $1", [
      hold.id,
    ]);
    expect(listed.status).toBe("Expired");
    expect(await boardOf(t, SCHEDULER, slot)).toMatchObject({ status: "Free", holdable: true });
    expect((await holdAs(t, SCHEDULER2, slot, CLIENT2)).id).toBeDefined();
    expect(await boardOf(t, SCHEDULER, slot)).toMatchObject({ status: "Held", client_name: "client2" });
  });
});
