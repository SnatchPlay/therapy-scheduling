// Ліміт чернеток картки (міграція intake_draft_quota, ADR 0008): 10 запитів до моделі за годину на користувача.
// Правило живе в private.take_intake_draft_slot; мутації правила (scripts/mutants.mjs, I12, I13) червонять ці тести.
// Межа PGlite: одне з'єднання, тож «одночасні» виклики йдуть по черзі й блокування користувача не перевіряється.
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let SCHEDULER: string, SCHEDULER2: string;

beforeAll(async () => {
  t = await createTestDb();
  SCHEDULER = t.users["scheduler1@example.test"];
  SCHEDULER2 = t.users["scheduler2@example.test"];
}, 60_000);

/** Як server action: rpc від імені користувача; true — запит до моделі дозволено й записано. */
async function takeAs(userId: string) {
  const [row] = await t.asUser<{ take: boolean }>(userId, "select public.take_intake_draft_slot() as take");
  return row.take;
}

const countInDb = async (userId: string) =>
  Number((await t.asService<{ n: string }>("select count(*) as n from public.intake_draft_requests where user_id = $1", [userId]))[0].n);

const clear = (userId: string) => t.asService("delete from public.intake_draft_requests where user_id = $1", [userId]);

const seed = (userId: string, minutesAgo: number, rows: number) =>
  t.asService(
    `insert into public.intake_draft_requests (user_id, created_at)
     select $1, clock_timestamp() - make_interval(mins => $2) from generate_series(1, $3)`,
    [userId, minutesAgo, rows],
  );

describe("ліміт чернеток: 10 на годину на користувача", () => {
  it("AC-INTAKE-08: перші десять запитів дозволено й записано, одинадцятий — відмова без запису", async () => {
    await clear(SCHEDULER);
    for (let i = 0; i < 10; i++) expect(await takeAs(SCHEDULER)).toBe(true);
    expect(await countInDb(SCHEDULER)).toBe(10);
    expect(await takeAs(SCHEDULER)).toBe(false);
    expect(await countInDb(SCHEDULER)).toBe(10);
  });

  it("AC-INTAKE-08: вичерпаний ліміт одного користувача не зачіпає іншого", async () => {
    await clear(SCHEDULER);
    await clear(SCHEDULER2);
    await seed(SCHEDULER, 5, 10);
    expect(await takeAs(SCHEDULER)).toBe(false);
    expect(await takeAs(SCHEDULER2)).toBe(true);
  });

  it("AC-INTAKE-08: запити старші за годину в ліміт не входять, молодші — входять", async () => {
    await clear(SCHEDULER);
    await seed(SCHEDULER, 61, 10);
    expect(await takeAs(SCHEDULER)).toBe(true);
    await clear(SCHEDULER);
    await seed(SCHEDULER, 59, 10);
    expect(await takeAs(SCHEDULER)).toBe(false);
  });

  it("AC-INTAKE-08: записи старші за добу прибираються самою функцією", async () => {
    await clear(SCHEDULER);
    await seed(SCHEDULER, 60 * 25, 4);
    expect(await takeAs(SCHEDULER)).toBe(true);
    expect(await countInDb(SCHEDULER)).toBe(1);
  });

  it("AC-INTAKE-08: без входу (anon) функція недоступна, у таблиці нічого не з'являється", async () => {
    await clear(SCHEDULER);
    await expect(t.asAnon("select public.take_intake_draft_slot()")).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("select private.take_intake_draft_slot()")).rejects.toThrow(/permission denied/);
    expect(await countInDb(SCHEDULER)).toBe(0);
  });

  it("AC-INTAKE-08: права на виконання прочитано з бази: обидві функції лише для authenticated (PUBLIC і anon — ні)", async () => {
    // Окремо від тесту вище: anon і без цього не пройшов би повз заборону на схему private, тож revoke там не доводиться.
    const rows = await t.asService<{ fn: string; role: string; ok: boolean }>(
      `select f as fn, r as role, has_function_privilege(r, f, 'EXECUTE') as ok
       from unnest(array['public.take_intake_draft_slot()', 'private.take_intake_draft_slot()']) f,
            unnest(array['public', 'anon', 'authenticated']) r`,
    );
    expect(rows.filter((r) => r.ok).map((r) => `${r.fn} ${r.role}`).sort()).toEqual([
      "private.take_intake_draft_slot() authenticated",
      "public.take_intake_draft_slot() authenticated",
    ]);
  });

  it("AC-INTAKE-08: захисні налаштування: приватна функція security definer з порожнім search_path, обгортка invoker, RLS увімкнено", async () => {
    const [fn] = await t.asService<{ definer: boolean; config: string[] | null }>(
      "select prosecdef as definer, proconfig as config from pg_proc where oid = 'private.take_intake_draft_slot()'::regprocedure",
    );
    expect(fn).toEqual({ definer: true, config: ['search_path=""'] });
    const [wrapper] = await t.asService<{ definer: boolean }>(
      "select prosecdef as definer from pg_proc where oid = 'public.take_intake_draft_slot()'::regprocedure",
    );
    expect(wrapper.definer).toBe(false);
    const [table] = await t.asService<{ rls: boolean }>("select relrowsecurity as rls from pg_class where oid = 'public.intake_draft_requests'::regclass");
    expect(table.rls).toBe(true);
  });

  it("AC-INTAKE-08: сесія без користувача (auth.uid() порожній) ліміту не отримує й нічого не записує", async () => {
    await clear(SCHEDULER);
    expect(await takeAs("")).toBe(false);
    expect(await countInDb(SCHEDULER)).toBe(0);
  });

  it("AC-INTAKE-08: через Data API таблиця закрита: ні читати, ні додавати, ні видаляти (скинути ліміт собі не можна)", async () => {
    await clear(SCHEDULER);
    await seed(SCHEDULER, 5, 10);
    await expect(t.asUser(SCHEDULER, "select * from public.intake_draft_requests")).rejects.toThrow(/permission denied/);
    await expect(
      t.asUser(SCHEDULER, "insert into public.intake_draft_requests (user_id) values ($1)", [SCHEDULER]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.asUser(SCHEDULER, "delete from public.intake_draft_requests where user_id = $1", [SCHEDULER]),
    ).rejects.toThrow(/permission denied/);
    expect(await countInDb(SCHEDULER)).toBe(10);
    expect(await takeAs(SCHEDULER)).toBe(false);
  });

  it("AC-INTAKE-08: фактичні права на таблицю в authenticated і anon — жодних", async () => {
    const rows = await t.asService<{ role: string; verb: string; ok: boolean }>(
      `select r as role, v as verb, has_table_privilege(r, 'public.intake_draft_requests', v) as ok
       from unnest(array['authenticated', 'anon']) r, unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) v`,
    );
    expect(rows.filter((r) => r.ok)).toEqual([]);
  });
});
