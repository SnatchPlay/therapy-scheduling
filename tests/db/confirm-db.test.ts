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

// Слот, що почався, у списку утримань не показано (AC-HOLD-42, AC-HOLD-38): статус утримання тоді читаємо з розкладу слотів.
const boardStatusOf = async (holdId: string) =>
  (await t.asUser<{ status: string }>(SCHEDULER, "select status from public.slot_board where hold_id = $1", [holdId]))[0]?.status;

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
    expect(await boardStatusOf(hold.id!)).toBe("Held");
  });

  it("AC-HOLD-23: за хвилину до початку слоту утримання підтверджується", async () => {
    const slot = await createSlot(t, T1, "now() + interval '2 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    await t.asService(
      "update public.slots set starts_at = now() + interval '1 minute', ends_at = now() + interval '61 minutes' where id = $1",
      [slot],
    );
    expect(await confirmAs(SCHEDULER, hold.id!)).toBe("confirmed");
    expect(await boardStatusOf(hold.id!)).toBe("Confirmed");
  });
});

describe("Підтвердження: гонки й межі", () => {
  // Сама гонка (підтвердження чекає на замок слоту, а там уже нове утримання) на PGlite з одним з'єднанням не відтворюється:
  // її закриває час після замка (clock_timestamp), перевірений вручну на Postgres 17 (.quality-trial/findings-log.md).
  it("AC-HOLD-13: прострочене утримання не підтверджується, навіть коли слот уже утримали знову; нове утримання лишається єдиним", async () => {
    const slot = await createSlot(t, T1, "now() + interval '10 days'");
    const h1 = await holdAs(t, SCHEDULER, slot, CLIENT1);
    await ageHold(t, h1.id!, 1440);
    const client2 = await ensureClient(t, "client2", "client2@example.test");
    const h2 = await holdAs(t, t.users["scheduler2@example.test"], slot, client2);
    expect(h2.id).toBeDefined();

    expect(await confirmAs(SCHEDULER, h1.id!)).toBe("This hold has expired. Hold the slot again.");
    // З таблиці: список утримань підтверджених сеансів не показує (AC-HOLD-38).
    const sessions = await t.asService("select id from public.holds where slot_id = $1 and confirmed_at is not null", [slot]);
    expect(sessions).toEqual([]);
    expect(await confirmAs(t.users["scheduler2@example.test"], h2.id!)).toBe("confirmed");
  });

  it("AC-HOLD-36: повторне підтвердження — «This hold is already confirmed.», слот лишається «Confirmed», хто й коли підтвердив не перезаписано", async () => {
    const slot = await createSlot(t, T1, "now() + interval '12 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    expect(await confirmAs(SCHEDULER, hold.id!)).toBe("confirmed");
    const confirmed = () =>
      t.asService<{ confirmed_at: string; confirmed_by: string }>(
        "select confirmed_at::text, confirmed_by from public.holds where id = $1",
        [hold.id],
      );
    const [first] = await confirmed();
    expect(first.confirmed_by).toBe(SCHEDULER);

    expect(await confirmAs(ADMIN, hold.id!)).toBe("This hold is already confirmed.");
    expect(await confirmed()).toEqual([first]);
  });

  it("підтвердження ставить час сервера, а не переданий: прямий PATCH із confirmed_at 2000-01-01", async () => {
    const slot = await createSlot(t, T1, "now() + interval '13 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    await t.asUser(SCHEDULER, "update public.holds set confirmed_at = '2000-01-01' where id = $1", [hold.id]);
    const [row] = await t.asService<{ recent: boolean }>(
      "select confirmed_at > now() - interval '1 hour' as recent from public.holds where id = $1",
      [hold.id],
    );
    expect(row).toEqual({ recent: true });
  });

  it("планувальник змінює через Data API лише confirmed_at: інші колонки утримання — permission denied", async () => {
    const slot = await createSlot(t, T1, "now() + interval '14 days'");
    const hold = await holdAs(t, SCHEDULER, slot, CLIENT1);
    for (const set of ["created_at = now()", `slot_id = '${slot}'`, `client_id = '${CLIENT1}'`, `confirmed_by = '${ADMIN}'`]) {
      await expect(t.asUser(SCHEDULER, `update public.holds set ${set} where id = $1`, [hold.id]), set).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it("останній запобіжник: два сеанси на одному слоті неможливі навіть повз тригери (унікальний індекс)", async () => {
    const slot = await createSlot(t, T1, "now() + interval '15 days'");
    const client2 = await ensureClient(t, "client2", "client2@example.test");
    const insertConfirmed = (client: string) =>
      `insert into public.holds (slot_id, client_id, created_by, confirmed_at, confirmed_by)
       values ('${slot}', '${client}', '${ADMIN}', now(), '${ADMIN}')`;
    await expect(
      t.asOwner(`do $$ begin
        set local session_replication_role = replica;
        ${insertConfirmed(CLIENT1)};
        ${insertConfirmed(client2)};
      end $$`),
    ).rejects.toThrow(/holds_one_session_per_slot/);
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
    // Відмова вище може йти від схеми private, а не від самої функції: явний revoke перевіряємо правами.
    const grants = await t.asService<{ fn: string; anon: boolean; authenticated: boolean }>(
      `select fn, has_function_privilege('anon', fn, 'execute') as anon, has_function_privilege('authenticated', fn, 'execute') as authenticated
       from unnest(array['public.confirm_hold(uuid)', 'public.hold_slot(uuid, uuid)', 'public.day_slots(uuid, date)']) as fn`,
    );
    expect(grants).toEqual(
      ["public.confirm_hold(uuid)", "public.hold_slot(uuid, uuid)", "public.day_slots(uuid, date)"].map((fn) => ({
        fn,
        anon: false,
        authenticated: true,
      })),
    );
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
