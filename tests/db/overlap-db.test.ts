// Перетин у часі утримань і сеансів одного клієнта (slot-holds, design.md Р8): тригер private.guard_new_hold.
// Слоти — створені тут, у різних терапевтів, з годинними й зсунутими межами.
import { beforeAll, describe, expect, it } from "vitest";
import { MESSAGES } from "@/lib/messages";
import { ageHold, createSlot, ensureClient, holdAs, practiceTime, quietDay } from "./fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let SCHEDULER: string, SCHEDULER2: string, ADMIN: string, THERAPIST: string;
const T1 = "therapist1@example.test";
const T2 = "therapist2@example.test";
const OVERLAP = "This client already has a hold or session at this time.";

beforeAll(async () => {
  t = await createTestDb();
  SCHEDULER = t.users["scheduler1@example.test"];
  SCHEDULER2 = t.users["scheduler2@example.test"];
  ADMIN = t.users["admin@example.test"];
  THERAPIST = t.users["therapist1@example.test"];
}, 60_000);

// Окремий день на тест: слот терапевта унікальний за початком, а перетин рахується між усіма слотами клієнта.
let week = 0;
const day = () => quietDay(week++);
const slotAt = (email: string, d: string, time: string) => createSlot(t, email, practiceTime(d, time));
// Слот, зсунутий відносно початку іншого на minutes (годинна довжина слота, як у сиді).
const slotShifted = (email: string, d: string, time: string, minutes: number) =>
  createSlot(t, email, `${practiceTime(d, time)} + interval '${minutes} minutes'`);

describe("Перетин утримань і сеансів клієнта", () => {
  it("AC-HOLD-25: client1 «Held» у therapist1 о 10:00 — інший планувальник не утримує за ним слот therapist2 о 10:00", async () => {
    const d = day();
    const client = await ensureClient(t, "client1", "client1@example.test");
    const first = await slotAt(T1, d, "10:00");
    const second = await slotAt(T2, d, "10:00");
    expect((await holdAs(t, SCHEDULER, first, client)).id).toBeDefined();
    expect(await holdAs(t, SCHEDULER2, second, client)).toEqual({ message: OVERLAP });
    const holds = await t.asService("select id from public.holds where slot_id = $1", [second]);
    expect(holds).toEqual([]);
  });

  it("AC-HOLD-25: частковий перетин (слот на 30 хвилин пізніше) теж відмова; повідомлення з requirements PM дослівно", async () => {
    const d = day();
    const client = await ensureClient(t, "client1", "client1@example.test");
    const first = await slotAt(T1, d, "10:00");
    const second = await slotShifted(T2, d, "10:00", 30);
    expect((await holdAs(t, SCHEDULER, first, client)).id).toBeDefined();
    expect(MESSAGES.CLIENT_OVERLAP).toBe(OVERLAP);
    expect(await holdAs(t, SCHEDULER, second, client)).toEqual({ message: OVERLAP });
  });

  it("AC-HOLD-25: підтверджений сеанс теж перетинається — утримання за client1 на цей час відмовляє", async () => {
    const d = day();
    const client = await ensureClient(t, "client1", "client1@example.test");
    const first = await slotAt(T1, d, "10:00");
    const second = await slotAt(T2, d, "10:00");
    const hold = await holdAs(t, SCHEDULER, first, client);
    await t.asUser(SCHEDULER, "select public.confirm_hold($1)", [hold.id]);
    await ageHold(t, hold.id!, 3 * 1440); // сеанс не спливає, на відміну від утримання
    expect(await holdAs(t, SCHEDULER, second, client)).toEqual({ message: OVERLAP });
  });

  it("AC-HOLD-26: утримання client1 у therapist1 о 10:00 «Expired» — слот therapist2 о 10:00 утримується за ним, «Held»", async () => {
    const d = day();
    const client = await ensureClient(t, "client1", "client1@example.test");
    const first = await slotAt(T1, d, "10:00");
    const second = await slotAt(T2, d, "10:00");
    const old = await holdAs(t, SCHEDULER, first, client);
    await ageHold(t, old.id!, 1440);
    const created = await holdAs(t, SCHEDULER, second, client);
    expect(created.id).toBeDefined();
    const [row] = await t.asUser<{ status: string }>(SCHEDULER, "select status from public.hold_list where hold_id = $1", [created.id]);
    expect(row.status).toBe("Held");
  });

  it("межа: кінець одного слота = початок іншого — не перетин, утримання створюється", async () => {
    const d = day();
    const client = await ensureClient(t, "client1", "client1@example.test");
    expect((await holdAs(t, SCHEDULER, await slotAt(T1, d, "10:00"), client)).id).toBeDefined();
    expect((await holdAs(t, SCHEDULER, await slotAt(T2, d, "11:00"), client)).id).toBeDefined();
  });

  it("AC-HOLD-25: порядок не важливий — є утримання о 11:00, слот о 10:00 (кінець = початок) утримується, а о 10:30 — відмова", async () => {
    const d = day();
    const client = await ensureClient(t, "client1", "client1@example.test");
    expect((await holdAs(t, SCHEDULER, await slotAt(T1, d, "11:00"), client)).id).toBeDefined();
    expect((await holdAs(t, SCHEDULER, await slotAt(T2, d, "10:00"), client)).id).toBeDefined();
    expect(await holdAs(t, SCHEDULER, await slotShifted(T2, d, "10:00", 30), client)).toEqual({ message: OVERLAP });
  });

  it("перетин рахується лише для одного клієнта: client2 на той самий час утримує слот therapist2", async () => {
    const d = day();
    const client1 = await ensureClient(t, "client1", "client1@example.test");
    const client2 = await ensureClient(t, "client2", "client2@example.test");
    expect((await holdAs(t, SCHEDULER, await slotAt(T1, d, "10:00"), client1)).id).toBeDefined();
    expect((await holdAs(t, SCHEDULER, await slotAt(T2, d, "10:00"), client2)).id).toBeDefined();
  });

  it("повторне утримання того самого слоту за тим самим клієнтом лишається «слот недоступний» (AC-HOLD-17), а не перетином", async () => {
    const d = day();
    const client = await ensureClient(t, "client1", "client1@example.test");
    const slot = await slotAt(T1, d, "10:00");
    expect((await holdAs(t, SCHEDULER, slot, client)).id).toBeDefined();
    expect(await holdAs(t, SCHEDULER, slot, client)).toEqual({ message: MESSAGES.SLOT_UNAVAILABLE });
  });

  it("правило діє й для прямого insert через Data API та для адміністратора", async () => {
    const d = day();
    const client = await ensureClient(t, "client1", "client1@example.test");
    const first = await slotAt(T1, d, "10:00");
    const second = await slotAt(T2, d, "10:00");
    expect((await holdAs(t, ADMIN, first, client)).id).toBeDefined();
    await expect(
      t.asUser(SCHEDULER, "insert into public.holds (slot_id, client_id) values ($1, $2)", [second, client]),
    ).rejects.toThrow("CLIENT_OVERLAP");
  });

  it("терапевт не утримує слот навіть без перетину (AC-HOLD-08 не змінено)", async () => {
    const d = day();
    const client = await ensureClient(t, "client2", "client2@example.test");
    const slot = await slotAt(T1, d, "10:00");
    await expect(t.asUser(THERAPIST, "select public.hold_slot($1, $2)", [slot, client])).rejects.toThrow("HOLD_FORBIDDEN");
  });
});

describe("Підтвердження іншим планувальником", () => {
  it("AC-HOLD-27: scheduler1 утримав слот therapist1 за client1, scheduler2 підтверджує — «Confirmed»", async () => {
    const d = day();
    const client = await ensureClient(t, "client1", "client1@example.test");
    const slot = await slotAt(T1, d, "10:00");
    const hold = await holdAs(t, SCHEDULER, slot, client);
    await t.asUser(SCHEDULER2, "select public.confirm_hold($1)", [hold.id]);
    const [row] = await t.asUser<{ status: string; confirmed_by: string }>(
      SCHEDULER2,
      "select h.status, p.id as confirmed_by from public.hold_list as h join public.holds as x on x.id = h.hold_id join public.profiles as p on p.id = x.confirmed_by where h.hold_id = $1",
      [hold.id],
    );
    expect(row).toEqual({ status: "Confirmed", confirmed_by: SCHEDULER2 });
    const [board] = await t.asUser<{ status: string }>(SCHEDULER, "select status from public.slot_board where slot_id = $1", [slot]);
    expect(board.status).toBe("Confirmed");
  });
});
