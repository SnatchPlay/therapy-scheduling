// Підготовка даних для тестів бази: слоти й клієнти через service_role, дії — від імені користувачів.
import { dbMessageCode, MESSAGES } from "@/lib/messages";
import type { TestDb } from "./supabase-pglite";

/** Слот терапевта; startsAt — SQL-вираз timestamptz (наприклад, "now() + interval '1 day'"). */
export async function createSlot(t: TestDb, therapistEmail: string, startsAt: string): Promise<string> {
  const [row] = await t.asService<{ id: string }>(
    `insert into public.slots (therapist_id, starts_at, ends_at)
     select id, ${startsAt}, ${startsAt} + interval '60 minutes' from public.therapists where email = $1
     returning id`,
    [therapistEmail],
  );
  return row.id;
}

/** Слот у даті й часі практики: «2027-03-02», «10:00» → America/Los_Angeles. */
export function practiceTime(day: string, time: string) {
  return `(timestamp '${day} ${time}' at time zone 'America/Los_Angeles')`;
}

export async function ensureClient(t: TestDb, name: string, email: string): Promise<string> {
  const [row] = await t.asService<{ id: string }>(
    `insert into public.clients (full_name, email, created_by)
     values ($1, $2, (select id from public.profiles where role = 'admin' limit 1))
     on conflict (email) do update set full_name = excluded.full_name
     returning id`,
    [name, email],
  );
  return row.id;
}

/** Як server action: rpc hold_slot від імені користувача; результат — id утримання або текст повідомлення. */
export async function holdAs(t: TestDb, userId: string, slotId: string, clientId: string) {
  try {
    const [row] = await t.asUser<{ id: string }>(userId, "select public.hold_slot($1, $2) as id", [slotId, clientId]);
    return { id: row.id };
  } catch (error) {
    return { message: MESSAGES[dbMessageCode(error as { message?: string })] };
  }
}

/** Зсунути час створення утримання на minutes хвилин у минуле (межі 24 годин: 1439 / 1440). */
export async function ageHold(t: TestDb, holdId: string, minutes: number) {
  await t.asService("update public.holds set created_at = now() - make_interval(mins => $2) where id = $1", [
    holdId,
    minutes,
  ]);
}

export type BoardRow = {
  slot_id: string;
  starts_at: string;
  status: string;
  client_name: string | null;
  held_until: string | null;
  holdable: boolean;
};

export async function boardOf(t: TestDb, userId: string, slotId: string): Promise<BoardRow | undefined> {
  const [row] = await t.asUser<BoardRow>(userId, "select * from public.slot_board where slot_id = $1", [slotId]);
  return row;
}
