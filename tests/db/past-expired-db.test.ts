// «Past» для слота, що почався без активного утримання, і прострочене утримання лише до початку слоту
// (slot-holds, design.md Р10): представлення slot_board і hold_list. Межі — зсувом starts_at / created_at від now().
import { beforeAll, describe, expect, it } from "vitest";
import { hasHoldableSlot } from "@/lib/slots";
import { ageHold, createSlot, ensureClient, holdAs } from "./fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let SCHEDULER: string, THERAPIST: string, CLIENT1: string;
const T1 = "therapist1@example.test";

beforeAll(async () => {
  t = await createTestDb();
  SCHEDULER = t.users["scheduler1@example.test"];
  THERAPIST = t.users[T1];
  CLIENT1 = await ensureClient(t, "client1", "client1@example.test");
}, 60_000);

type BoardItem = { slot_id: string; status: string; holdable: boolean };
const boardFor = (userId: string, slotIds: string[]) =>
  t.asUser<BoardItem>(
    userId,
    "select slot_id, status, holdable from public.slot_board where slot_id = any($1::uuid[]) order by starts_at",
    [slotIds],
  );
const inHoldList = async (userId: string, holdId: string) =>
  (await t.asUser<{ status: string }>(userId, "select status from public.hold_list where hold_id = $1", [holdId]))[0]?.status;
// Слот, що почався: утримати його вже не можна, тож утримання створюємо до початку й пересуваємо слот у минуле.
const startSlotAt = (slotId: string, sqlTime: string) =>
  t.asService("update public.slots set starts_at = " + sqlTime + ", ends_at = " + sqlTime + " + interval '60 minutes' where id = $1", [slotId]);

describe("Статус «Past»", () => {
  it("AC-HOLD-32: вільний слот, що почався, і слот із простроченим утриманням — «Past», не вільні й не утримуються", async () => {
    const free = await createSlot(t, T1, "now() - interval '150 minutes'");
    const withExpired = await createSlot(t, T1, "now() + interval '3 days'");
    const hold = await holdAs(t, SCHEDULER, withExpired, CLIENT1);
    await ageHold(t, hold.id!, 1500);
    await startSlotAt(withExpired, "now() - interval '90 minutes'");

    const rows = await boardFor(SCHEDULER, [free, withExpired]);
    expect(rows).toEqual([
      { slot_id: free, status: "Past", holdable: false },
      { slot_id: withExpired, status: "Past", holdable: false },
    ]);
    const another = await ensureClient(t, "client2", "client2@example.test");
    expect(await holdAs(t, SCHEDULER, withExpired, another)).toEqual({
      message: "This slot has already started and cannot be held.",
    });
  });

  it("AC-HOLD-32: слот, що ще не почався, лишається «Free»; «Held» і «Confirmed» слоти, що почались, — не «Past»", async () => {
    const future = await createSlot(t, T1, "now() + interval '4 days'");
    const held = await createSlot(t, T1, "now() + interval '5 days'");
    const confirmed = await createSlot(t, T1, "now() + interval '6 days'");
    const heldHold = await holdAs(t, SCHEDULER, held, CLIENT1);
    const client3 = await ensureClient(t, "client3", "client3@example.test");
    const confirmedHold = await holdAs(t, SCHEDULER, confirmed, client3);
    await t.asUser(SCHEDULER, "select public.confirm_hold($1)", [confirmedHold.id]);
    // Обидва слоти вже почались (утримання лишається діяти, поки не прострочене; сеанс — завжди).
    // Різний початок: слот терапевта унікальний за початком, а now() у двох запитах поспіль може збігтися.
    await startSlotAt(held, "now() - interval '10 minutes'");
    await startSlotAt(confirmed, "now() - interval '20 minutes'");

    const rows = await boardFor(SCHEDULER, [future, held, confirmed]);
    expect(Object.fromEntries(rows.map((r) => [r.slot_id, r.status]))).toEqual({
      [future]: "Free",
      [held]: "Held",
      [confirmed]: "Confirmed",
    });
    expect(heldHold.id).toBeDefined();
  });

  it("AC-HOLD-33: слоти «Past», «Past», «Held», «Confirmed» — вільних для повідомлення «No free slots on this day.» немає", async () => {
    const past1 = await createSlot(t, T1, "now() - interval '3 hours'");
    const past2 = await createSlot(t, T1, "now() - interval '2 hours'");
    const held = await createSlot(t, T1, "now() + interval '7 days'");
    const confirmed = await createSlot(t, T1, "now() + interval '8 days'");
    await holdAs(t, SCHEDULER, held, CLIENT1);
    const client4 = await ensureClient(t, "client4", "client4@example.test");
    const hold = await holdAs(t, SCHEDULER, confirmed, client4);
    await t.asUser(SCHEDULER, "select public.confirm_hold($1)", [hold.id]);

    const rows = await boardFor(SCHEDULER, [past1, past2, held, confirmed]);
    expect(rows.map((r) => r.status).sort()).toEqual(["Confirmed", "Held", "Past", "Past"]);
    expect(hasHoldableSlot(rows)).toBe(false);
    // Контраст: з вільним слотом повідомлення б не було.
    const free = await createSlot(t, T1, "now() + interval '9 days'");
    expect(hasHoldableSlot(await boardFor(SCHEDULER, [past1, free]))).toBe(true);
  });

  it("AC-HOLD-32: власний слот терапевта, що почався, — «Past» (однаково для всіх ролей)", async () => {
    const slot = await createSlot(t, T1, "now() - interval '30 minutes'");
    expect(await boardFor(THERAPIST, [slot])).toEqual([{ slot_id: slot, status: "Past", holdable: false }]);
  });
});

describe("Межа початку слоту", () => {
  // Обидва представлення беруть «слот почався» з private.slot_started: межу «з моменту початку включно» (AC-HOLD-29,
  // AC-HOLD-32) закріплюємо тут, бо тест нижче читає представлення вже в наступній транзакції, де now() більший.
  it("AC-HOLD-29, AC-HOLD-32: рівно в момент початку слот уже почався, за мікросекунду до початку — ще ні", async () => {
    const [row] = await t.asOwner<{ at: boolean; before: boolean }>(
      "select private.slot_started(now(), now()) as at, private.slot_started(now() + interval '1 microsecond', now()) as before",
    );
    expect(row).toEqual({ at: true, before: false });
  });
});

describe("Прострочене утримання в списку утримань планувальника", () => {
  it("AC-HOLD-28: за хвилину до початку слоту прострочене утримання client1 видно зі статусом «Expired»", async () => {
    const slot = await createSlot(t, T1, "now() + interval '5 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    await ageHold(t, hold.id!, 1500);
    await startSlotAt(slot, "now() + interval '1 minute'");
    expect(await inHoldList(SCHEDULER, hold.id!)).toBe("Expired");
  });

  it("AC-HOLD-29: у момент початку слоту і пізніше прострочене утримання в списку немає", async () => {
    const slot = await createSlot(t, T1, "now() + interval '6 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    await ageHold(t, hold.id!, 1500);
    await startSlotAt(slot, "now()");
    expect(await inHoldList(SCHEDULER, hold.id!)).toBeUndefined();
    await startSlotAt(slot, "now() - interval '2 hours'");
    expect(await inHoldList(SCHEDULER, hold.id!)).toBeUndefined();
  });

  it("AC-HOLD-29: правило лише для простроченого — «Held» і «Confirmed» утримання слоту, що почався, лишаються в списку", async () => {
    const heldSlot = await createSlot(t, T1, "now() + interval '10 days'");
    const heldHold = await holdAs(t, SCHEDULER, heldSlot, CLIENT1);
    const client5 = await ensureClient(t, "client5", "client5@example.test");
    const sessionSlot = await createSlot(t, T1, "now() + interval '11 days'");
    const sessionHold = await holdAs(t, SCHEDULER, sessionSlot, client5);
    await t.asUser(SCHEDULER, "select public.confirm_hold($1)", [sessionHold.id]);
    await ageHold(t, sessionHold.id!, 3000);
    await startSlotAt(heldSlot, "now() - interval '5 minutes'");
    await startSlotAt(sessionSlot, "now() - interval '7 minutes'");
    expect(await inHoldList(SCHEDULER, heldHold.id!)).toBe("Held");
    expect(await inHoldList(SCHEDULER, sessionHold.id!)).toBe("Confirmed");
  });
});
