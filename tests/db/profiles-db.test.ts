// Профіль і роль (profiles_and_roles, client_card): роль змінює лише service_role. Пастка «оновити власний рядок» закрита
// колонковим grant: authenticated оновлює лише full_name, тож користувач без ролі не підвищить себе сам (AC-CARD-11).
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let NEWUSER: string, THERAPIST: string, SCHEDULER: string, ADMIN: string;

beforeAll(async () => {
  t = await createTestDb();
  NEWUSER = t.users["newuser1@example.test"];
  THERAPIST = t.users["therapist1@example.test"];
  SCHEDULER = t.users["scheduler1@example.test"];
  ADMIN = t.users["admin@example.test"];
}, 60_000);

const roleOf = async (id: string) => (await t.asService<{ role: string | null }>("select role from public.profiles where id = $1", [id]))[0].role;

describe("Пастка «оновити власний рядок + колонка role»", () => {
  it("AC-CARD-11: користувач без ролі не підвищить себе: update role відмовляє, роль лишається порожньою, а даних клієнтів він так і не бачить", async () => {
    await expect(t.asUser(NEWUSER, "update public.profiles set role = 'admin' where id = $1", [NEWUSER])).rejects.toThrow(/permission denied/);
    await expect(t.asUser(NEWUSER, "update public.profiles set role = 'scheduler', full_name = 'X' where id = $1", [NEWUSER])).rejects.toThrow(
      /permission denied/,
    );
    expect(await roleOf(NEWUSER)).toBeNull();
    expect(await t.asUser(NEWUSER, "select id from public.clients")).toEqual([]);
  });

  it("терапевт і планувальник не підвищують ролі собі й іншим; чужий рядок профілю не змінити взагалі", async () => {
    await expect(t.asUser(THERAPIST, "update public.profiles set role = 'admin' where id = $1", [THERAPIST])).rejects.toThrow(/permission denied/);
    await expect(t.asUser(SCHEDULER, "update public.profiles set role = 'admin' where id = $1", [NEWUSER])).rejects.toThrow(/permission denied/);
    expect(await roleOf(THERAPIST)).toBe("therapist");
    expect(await roleOf(NEWUSER)).toBeNull();
    // Навіть дозволена колонка чужого рядка: політика profiles_update_own не пускає (нуль рядків). Беремо адміністратора:
    // він бачить усі профілі (select-політика), тож лише update-політика тримає межу.
    expect(await t.asUser(ADMIN, "update public.profiles set full_name = 'Hacked' where id = $1 returning id", [NEWUSER])).toEqual([]);
    expect((await t.asService<{ full_name: string }>("select full_name from public.profiles where id = $1", [NEWUSER]))[0].full_name).not.toBe("Hacked");
  });

  it("дозволений шлях: власне ім'я змінюється, роль і email — ні", async () => {
    await t.asUser(NEWUSER, "update public.profiles set full_name = 'New User Renamed' where id = $1", [NEWUSER]);
    expect((await t.asService<{ full_name: string }>("select full_name from public.profiles where id = $1", [NEWUSER]))[0].full_name).toBe("New User Renamed");
    await expect(t.asUser(NEWUSER, "update public.profiles set email = 'someone@example.test' where id = $1", [NEWUSER])).rejects.toThrow(/permission denied/);
    expect(await roleOf(NEWUSER)).toBeNull();
  });

  it("insert і delete профілю недоступні користувачеві; anon не читає й не пише", async () => {
    await expect(t.asUser(NEWUSER, "insert into public.profiles (id, role) values (gen_random_uuid(), 'admin')")).rejects.toThrow(/permission denied/);
    await expect(t.asUser(ADMIN, "delete from public.profiles where id = $1", [NEWUSER])).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("select id from public.profiles")).rejects.toThrow(/permission denied/);
    await expect(t.asAnon("update public.profiles set role = 'admin'")).rejects.toThrow(/permission denied/);
  });

  it("профіль читає власник і адміністратор, чужий — ні", async () => {
    expect((await t.asUser(NEWUSER, "select id from public.profiles")).map((r) => (r as { id: string }).id)).toEqual([NEWUSER]);
    expect((await t.asUser(THERAPIST, "select id from public.profiles")).map((r) => (r as { id: string }).id)).toEqual([THERAPIST]);
    expect((await t.asUser(ADMIN, "select id from public.profiles")).length).toBeGreaterThan(1);
  });
});
