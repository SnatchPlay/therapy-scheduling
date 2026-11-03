// Фікстура e2e (tests/e2e/fixtures/e2e-data.sql): доводить передумови e2e-спек без Docker — клієнт є лише в одного з двох
// терапевтів, у списку утримань планувальника є рядок, повторний запуск нічого не дублює. Назви без AC ID: це перевірка даних.
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./supabase-pglite";

const FIXTURE = readFileSync(new URL("../e2e/fixtures/e2e-data.sql", import.meta.url), "utf8");
const EMAIL = "uat-ac-card-05@example.test";

let t: TestDb;
let THERAPIST1: string, THERAPIST2: string, SCHEDULER: string;

const visibleTo = async (userId: string) =>
  (await t.asUser<{ email: string }>(userId, "select email from public.clients where email = $1", [EMAIL])).map((r) => r.email);

const counts = async () =>
  (
    await t.asService<{ clients: number; holds: number; slots: number }>(
      `select (select count(*) from public.clients where email = $1)::int as clients,
              (select count(*) from public.holds)::int as holds,
              (select count(*) from public.slots)::int as slots`,
      [EMAIL],
    )
  )[0];

beforeAll(async () => {
  t = await createTestDb();
  THERAPIST1 = t.users["therapist1@example.test"];
  THERAPIST2 = t.users["therapist2@example.test"];
  SCHEDULER = t.users["scheduler1@example.test"];
  await t.asOwner(FIXTURE);
}, 60_000);

describe("e2e-фікстура e2e-data.sql", () => {
  it("клієнт є своїм лише для therapist2: therapist1 його не бачить", async () => {
    expect(await visibleTo(THERAPIST2)).toEqual([EMAIL]);
    expect(await visibleTo(THERAPIST1)).toEqual([]);
  });

  it("список утримань планувальника не порожній: одне утримання «Held» у слоті Therapist Two", async () => {
    const rows = await t.asUser<{ therapist_name: string; status: string }>(SCHEDULER, "select therapist_name, status from public.hold_list");
    expect(rows).toEqual([{ therapist_name: "Therapist Two", status: "Held" }]);
  });

  it("повторний запуск нічого не дублює", async () => {
    const before = await counts();
    await t.asOwner(FIXTURE);
    expect(await counts()).toEqual(before);
    expect(before).toMatchObject({ clients: 1, holds: 1 });
  });
});
