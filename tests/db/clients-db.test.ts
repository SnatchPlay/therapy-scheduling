// Картка клієнта (client-cards): правила виконує база — обмеження таблиці clients і RLS.
// Повідомлення — ті, що показує server action src/app/clients/actions.ts через clientErrorCode.
import { beforeAll, describe, expect, it } from "vitest";
import { clientErrorCode, MESSAGES } from "@/lib/messages";
import { createTestDb, type TestDb } from "./supabase-pglite";

let t: TestDb;
let SCHEDULER: string, ADMIN: string, THERAPIST: string;

beforeAll(async () => {
  t = await createTestDb();
  SCHEDULER = t.users["scheduler1@example.test"];
  ADMIN = t.users["admin@example.test"];
  THERAPIST = t.users["therapist1@example.test"];
}, 60_000);

/** Те саме, що робить server action: insert у clients від імені користувача; помилка → текст повідомлення. */
async function createClientAs(userId: string, fullName: string, email: string) {
  try {
    await t.asUser(userId, "insert into public.clients (full_name, email) values ($1, $2)", [fullName, email]);
    return "created";
  } catch (error) {
    return MESSAGES[clientErrorCode(error as { code?: string; message?: string })];
  }
}

describe("Картка клієнта", () => {
  it("AC-HOLD-10: планувальник створює клієнта Client Three, і його можна вибрати", async () => {
    expect(await createClientAs(SCHEDULER, "Client Three", "client3@example.test")).toBe("created");
    const rows = await t.asUser<{ full_name: string }>(
      SCHEDULER,
      "select full_name from public.clients where email = 'client3@example.test'",
    );
    expect(rows).toEqual([{ full_name: "Client Three" }]);
  });

  it("AC-HOLD-11: порожнє ім'я — клієнта не створено, повідомлення про ім'я та email", async () => {
    expect(await createClientAs(SCHEDULER, "", "client11@example.test")).toBe(
      "Enter the client's name and a valid email.",
    );
    expect(await createClientAs(SCHEDULER, "   ", "client11@example.test")).toBe(
      "Enter the client's name and a valid email.",
    );
    const [{ n }] = await t.asService<{ n: number }>(
      "select count(*)::int as n from public.clients where email = 'client11@example.test'",
    );
    expect(n).toBe(0);
  });

  it("AC-HOLD-15: email без знака @ — клієнта не створено", async () => {
    expect(await createClientAs(SCHEDULER, "Client Three", "client3example.test")).toBe(
      "Enter the client's name and a valid email.",
    );
    const [{ n }] = await t.asService<{ n: number }>(
      "select count(*)::int as n from public.clients where email = 'client3example.test'",
    );
    expect(n).toBe(0);
  });

  it("AC-HOLD-16: клієнт з email client1@example.test уже існує — другого не створено", async () => {
    expect(await createClientAs(ADMIN, "Client One", "client1@example.test")).toBe("created");
    expect(await createClientAs(SCHEDULER, "Client One Again", "client1@example.test")).toBe(
      "A client with this email already exists.",
    );
    const [{ n }] = await t.asService<{ n: number }>(
      "select count(*)::int as n from public.clients where email = 'client1@example.test'",
    );
    expect(n).toBe(1);
  });

  it("AC-HOLD-16: Client1@Example.TEST і « client1@example.test » — дубль client1@example.test", async () => {
    expect(await createClientAs(SCHEDULER, "Client One Upper", "Client1@Example.TEST")).toBe(
      "A client with this email already exists.",
    );
    expect(await createClientAs(SCHEDULER, "Client One Spaces", " client1@example.test ")).toBe(
      "A client with this email already exists.",
    );
    expect(await createClientAs(SCHEDULER, "Client Four", " Client4@Example.TEST ")).toBe("created");
    const [row] = await t.asService<{ email: string }>(
      "select email from public.clients where full_name = 'Client Four'",
    );
    expect(row.email).toBe("client4@example.test");
  });

  it("без входу (anon) клієнтів не видно й не створити", async () => {
    await expect(t.asAnon("select id from public.clients")).rejects.toThrow(/permission denied/);
    await expect(
      t.asAnon("insert into public.clients (full_name, email) values ('X', 'anon@example.test')"),
    ).rejects.toThrow(/permission denied/);
  });

  it("терапевт не створює клієнтів і не бачить картки без своїх утримань (матриця прав)", async () => {
    await expect(
      t.asUser(THERAPIST, "insert into public.clients (full_name, email) values ('X', 'x@example.test')"),
    ).rejects.toThrow(/row-level security/);
    expect(await t.asUser(THERAPIST, "select id from public.clients")).toEqual([]);
  });
});
