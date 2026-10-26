// Акаунти PM (supabase/pm-users.json): кожен терапевт PM має рядок therapists зі слотами, а сценарій «свій клієнт» працює
// на них так само, як на therapist1 і therapist2. Користувачів створює npm run users:pm; тут їх імітуємо через Auth.
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { createSlot, holdAs } from "./fixtures";
import { createTestDb, type TestDb } from "./supabase-pglite";

type PmUser = { email: string; full_name: string; role: string | null };
const users: PmUser[] = JSON.parse(readFileSync(new URL("../../supabase/pm-users.json", import.meta.url), "utf8"));

let t: TestDb;
const ids: Record<string, string> = {};

beforeAll(async () => {
  t = await createTestDb();
  for (const u of users) {
    ids[u.email] = await t.createAuthUser(u.email);
    if (u.role) await t.asService("update public.profiles set role = $2 where id = $1", [ids[u.email], u.role]);
  }
}, 60_000);

describe("pm-users.json", () => {
  it("лише синтетичні pm-<роль>@example.test з відомою роллю або без ролі", () => {
    expect(users.length).toBeGreaterThanOrEqual(5);
    for (const u of users) {
      expect(u.email).toMatch(/^pm-[a-z0-9]+@example\.test$/);
      expect(["admin", "scheduler", "therapist", null]).toContain(u.role);
    }
    expect(new Set(users.map((u) => u.email)).size).toBe(users.length);
    expect(users.map((u) => u.role).filter((r) => r === null)).toHaveLength(1);
  });

  it("кожен терапевт PM має рядок therapists і слоти; через RLS бачить лише власні слоти й лише себе", async () => {
    for (const u of users.filter((x) => x.role === "therapist")) {
      const [row] = await t.asService<{ id: string; n: number }>(
        "select th.id, count(s.id)::int as n from public.therapists th left join public.slots s on s.therapist_id = th.id where th.email = $1 group by th.id",
        [u.email],
      );
      expect(row.n).toBeGreaterThan(0);
      // Кожну таблицю окремо: політика slots і політика therapists мають тримати межу кожна сама.
      const slotOwners = await t.asUser<{ therapist_id: string }>(ids[u.email], "select distinct therapist_id from public.slots");
      expect(slotOwners).toEqual([{ therapist_id: row.id }]);
      const visibleTherapists = await t.asUser<{ email: string }>(ids[u.email], "select email from public.therapists");
      expect(visibleTherapists).toEqual([{ email: u.email }]);
    }
  });
});

describe("Сценарій приймання на акаунтах PM", () => {
  it("AC-CARD-04: клієнт, утриманий у pm-therapist, — свій для нього й чужий для pm-therapist2, а pm-noaccess не бачить нічого", async () => {
    const [client] = await t.asService<{ id: string }>(
      `insert into public.clients (full_name, email, created_by) values ('Client PM', 'client-pm@example.test', $1) returning id`,
      [ids["pm-admin@example.test"]],
    );
    const slot = await createSlot(t, "pm-therapist@example.test", "now() + interval '3 days'");
    expect(await holdAs(t, ids["pm-scheduler@example.test"], slot, client.id)).toHaveProperty("id");

    const names = async (email: string) =>
      (await t.asUser<{ full_name: string }>(ids[email], "select full_name from public.clients")).map((r) => r.full_name);
    expect(await names("pm-therapist@example.test")).toEqual(["Client PM"]);
    expect(await names("pm-therapist2@example.test")).toEqual([]);
    expect(await names("pm-noaccess@example.test")).toEqual([]);
    expect(await names("pm-scheduler@example.test")).toEqual(["Client PM"]);
    expect(await names("pm-admin@example.test")).toEqual(["Client PM"]);
  });
});
