// Підтвердження утримання (slot-holds): тригер private.guard_confirm і confirm_hold; «Expired» у hold_list.
import { beforeAll, describe, expect, it } from "vitest";
import { dbMessageCode, MESSAGES } from "@/lib/messages";
import { ageHold, boardOf, createSlot, ensureClient, holdAs } from "./fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let SCHEDULER: string, ADMIN: string, THERAPIST: string;
let CLIENT1: string;
const T1 = "therapist1@example.test";

beforeAll(async () => {
  t = await createTestDb();
  SCHEDULER = t.users["scheduler1@example.test"];
  ADMIN = t.users["admin@example.test"];
  THERAPIST = t.users["therapist1@example.test"];
  CLIENT1 = await ensureClient(t, "client1", "client1@example.test");
}, 60_000);

/** Як server action: rpc confirm_hold; результат — "confirmed" або текст повідомлення. */
async function confirmAs(userId: string, holdId: string) {
  try {
    await t.asUser(userId, "select public.confirm_hold($1)", [holdId]);
    return "confirmed";
  } catch (error) {
    return MESSAGES[dbMessageCode(error as { message?: string })];
  }
}

const statusOf = async (holdId: string) => {
  const [row] = await t.asUser<{ status: string; held_until: string | null }>(
    SCHEDULER,
    "select status, held_until from public.hold_list where hold_id = $1",
    [holdId],
  );
  return row;
};

describe("Підтвердження", () => {
  it("AC-HOLD-12: непрострочене утримання підтверджено — «Confirmed», без Held until, недоступне й після 24 годин", async () => {
    const slot = await createSlot(t, T1, "now() + interval '3 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    expect(await confirmAs(SCHEDULER, hold.id!)).toBe("confirmed");
    expect(await boardOf(t, SCHEDULER, slot)).toMatchObject({ status: "Confirmed", held_until: null, holdable: false });

    await ageHold(t, hold.id!, 1441);
    expect(await boardOf(t, SCHEDULER, slot)).toMatchObject({ status: "Confirmed", holdable: false });
    expect(await holdAs(t, SCHEDULER, slot, CLIENT1)).toEqual({ message: "This slot is no longer available." });
  });

  it("AC-HOLD-13: прострочене утримання не підтверджується", async () => {
    const slot = await createSlot(t, T1, "now() + interval '4 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    await ageHold(t, hold.id!, 1440);
    expect(await confirmAs(SCHEDULER, hold.id!)).toBe("This hold has expired. Hold the slot again.");
    expect((await statusOf(hold.id!)).status).toBe("Expired");
  });

  it("AC-HOLD-14: терапевт не підтверджує утримання", async () => {
    const slot = await createSlot(t, T1, "now() + interval '5 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    expect(await confirmAs(THERAPIST, hold.id!)).toBe("Only schedulers and admins can confirm holds.");
    // Прямий PATCH через Data API: RLS не дає терапевту змінити рядок.
    await t.asUser(THERAPIST, "update public.holds set confirmed_at = now() where id = $1", [hold.id]);
    expect((await statusOf(hold.id!)).status).toBe("Held");
  });

  it("AC-HOLD-19: адміністратор утримує й підтверджує — «Confirmed», як у планувальника", async () => {
    const slot = await createSlot(t, T1, "now() + interval '6 days'");
    const hold = await holdAs(t, ADMIN, slot, CLIENT1);
    expect(await confirmAs(ADMIN, hold.id!)).toBe("confirmed");
    expect(await boardOf(t, SCHEDULER, slot)).toMatchObject({ status: "Confirmed" });
  });

  it("AC-HOLD-22: слот почався (з моменту початку включно) — не підтверджується, лишається «Held»", async () => {
    const slot = await createSlot(t, T1, "now() + interval '2 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    // Слот починається рівно зараз: утримання створене раніше й ще не прострочене.
    await t.asService("update public.slots set starts_at = now(), ends_at = now() + interval '60 minutes' where id = $1", [
      slot,
    ]);
    expect(await confirmAs(SCHEDULER, hold.id!)).toBe("This slot has already started and cannot be confirmed.");
    expect((await statusOf(hold.id!)).status).toBe("Held");
  });

  it("AC-HOLD-23: за хвилину до початку слоту утримання підтверджується", async () => {
    const slot = await createSlot(t, T1, "now() + interval '2 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    await t.asService(
      "update public.slots set starts_at = now() + interval '1 minute', ends_at = now() + interval '61 minutes' where id = $1",
      [slot],
    );
    expect(await confirmAs(SCHEDULER, hold.id!)).toBe("confirmed");
    expect((await statusOf(hold.id!)).status).toBe("Confirmed");
  });
});

describe("Підтвердження: гонки й межі", () => {
  it("AC-HOLD-12: застаріле утримання не стає другим сеансом, коли слот уже утримав інший планувальник", async () => {
    // Відтворення гонки з рев'ю бази: H1 прострочилось, SCHEDULER2 утримав слот (H2), а підтвердження H1
    // почалось до межі 24 годин і бачило H1 активним. created_at H1 повертаємо в «активний» стан вручну.
    const slot = await createSlot(t, T1, "now() + interval '10 days'");
    const h1 = await holdAs(t, SCHEDULER, slot, CLIENT1);
    await ageHold(t, h1.id!, 1440);
    const client2 = await ensureClient(t, "client2", "client2@example.test");
    const h2 = await holdAs(t, t.users["scheduler2@example.test"], slot, client2);
    expect(h2.id).toBeDefined();
    await ageHold(t, h1.id!, 60);

    expect(await confirmAs(SCHEDULER, h1.id!)).toBe("This slot is no longer available.");
    const rows = await t.asUser<{ hold_id: string; status: string }>(
      SCHEDULER,
      "select hold_id, status from public.hold_list where slot_id = $1 and status = 'Confirmed'",
      [slot],
    );
    expect(rows).toEqual([]);
    // Реальний стан після гонки: H1 прострочене, тож H2 підтверджується.
    await ageHold(t, h1.id!, 1440);
    expect(await confirmAs(t.users["scheduler2@example.test"], h2.id!)).toBe("confirmed");
  });

  it("AC-HOLD-13: утримання прострочене й слот уже почався — «This hold has expired. Hold the slot again.»", async () => {
    const slot = await createSlot(t, T1, "now() + interval '11 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    await ageHold(t, hold.id!, 1500);
    await t.asService(
      "update public.slots set starts_at = now() - interval '5 minutes', ends_at = now() + interval '55 minutes' where id = $1",
      [slot],
    );
    expect(await confirmAs(SCHEDULER, hold.id!)).toBe("This hold has expired. Hold the slot again.");
  });

  it("без входу (anon) не викликає підтвердження й не змінює утримання", async () => {
    await expect(t.asAnon("select public.confirm_hold(gen_random_uuid())")).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("update public.holds set confirmed_at = now()")).rejects.toThrow(/permission denied/);
  });
});

describe("Утримання планувальника", () => {
  it("AC-HOLD-20: планувальник бачить прострочене утримання client1 зі статусом «Expired», а слот — вільним", async () => {
    const slot = await createSlot(t, T1, "now() + interval '7 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    await ageHold(t, hold.id!, 1470); // 24 год 30 хв — як перегляд 2026-11-03 о 15:00 для утримання від 14:30
    const [row] = await t.asUser<{ client_name: string; status: string }>(
      SCHEDULER,
      "select client_name, status from public.hold_list where hold_id = $1",
      [hold.id],
    );
    expect(row).toEqual({ client_name: "client1", status: "Expired" });
    expect(await boardOf(t, SCHEDULER, slot)).toMatchObject({ status: "Free", holdable: true });
  });
});
