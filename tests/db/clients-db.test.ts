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
  // Кожен тест бере свої дані; спільне — лише client1, який за AC-HOLD-16 «уже існує».
  await t.asService("insert into public.clients (full_name, email, created_by) values ('Client One', 'client1@example.test', $1)", [
    ADMIN,
  ]);
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
  it("AC-HOLD-10: планувальник створює клієнта Client Three, і він є у списку клієнтів", async () => {
    expect(await createClientAs(SCHEDULER, "Client Three", "client3@example.test")).toBe("created");
    const rows = await t.asUser<{ full_name: string; created_by: string }>(
      SCHEDULER,
      "select full_name, created_by from public.clients where email = 'client3@example.test'",
    );
    expect(rows).toEqual([{ full_name: "Client Three", created_by: SCHEDULER }]);
  });

  it("AC-HOLD-10: адміністратор теж створює клієнта (AC-HOLD-19); ім'я не латиницею приймаємо", async () => {
    expect(await createClientAs(ADMIN, "Клієнт П'ять", "client5@example.test")).toBe("created");
  });

  it("автора картки не підробити: created_by ставить база", async () => {
    await expect(
      t.asUser(SCHEDULER, "insert into public.clients (full_name, email, created_by) values ('X', 'x6@example.test', $1)", [
        ADMIN,
      ]),
    ).rejects.toThrow(/permission denied/);
  });

  it("AC-HOLD-11: порожнє ім'я — клієнта не створено, повідомлення про ім'я та email", async () => {
    expect(await createClientAs(SCHEDULER, "", "client11@example.test")).toBe(
      "Enter the client's name and a valid email.",
    );
    for (const blank of ["   ", "\t", "\n \r", "\u00a0", "\u00a0\u2007\u3000\ufeff"]) {
      expect(await createClientAs(SCHEDULER, blank, "client11@example.test")).toBe(
        "Enter the client's name and a valid email.",
      );
    }
    const [{ n }] = await t.asService<{ n: number }>(
      "select count(*)::int as n from public.clients where email = 'client11@example.test'",
    );
    expect(n).toBe(0);
  });

  it("AC-HOLD-15: email без знака @ — клієнта не створено", async () => {
    expect(await createClientAs(SCHEDULER, "Client Three", "client3example.test")).toBe(
      "Enter the client's name and a valid email.",
    );
    // Невидимий знак усередині — теж не email.
    expect(await createClientAs(SCHEDULER, "Client Three", "client3\u00a0x@example.test")).toBe(
      "Enter the client's name and a valid email.",
    );
    const [{ n }] = await t.asService<{ n: number }>(
      "select count(*)::int as n from public.clients where email = 'client3example.test'",
    );
    expect(n).toBe(0);
  });

  it("AC-HOLD-16: клієнт з email client1@example.test уже існує — другого не створено", async () => {
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
    for (const variant of [" client1@example.test ", "client1@example.test\u00a0", "\tclient1@example.test\n"]) {
      expect(await createClientAs(SCHEDULER, "Client One Again", variant)).toBe("A client with this email already exists.");
    }
    expect(await createClientAs(SCHEDULER, "Client Four", " Client4@Example.TEST ")).toBe("created");
    const [row] = await t.asService<{ email: string }>(
      "select email from public.clients where full_name = 'Client Four'",
    );
    expect(row.email).toBe("client4@example.test");
  });

  it("запити, запущені разом, ідуть кожен від свого користувача", async () => {
    const [scheduler, therapist] = await Promise.all([
      t.asUser<{ uid: string }>(SCHEDULER, "select auth.uid() as uid"),
      t.asUser<{ uid: string }>(THERAPIST, "select auth.uid() as uid"),
    ]);
    expect([scheduler[0].uid, therapist[0].uid]).toEqual([SCHEDULER, THERAPIST]);
    const [therapistInsert] = await Promise.allSettled([
      t.asUser(THERAPIST, "insert into public.clients (full_name, email) values ('X', 'x7@example.test')"),
      t.asUser(SCHEDULER, "select 1"),
    ]);
    expect(therapistInsert.status).toBe("rejected");
  });

  it("AC-HOLD-16: зміна email тим, хто обходить RLS (виправлення даних), теж нормалізується", async () => {
    await t.asService(
      "insert into public.clients (full_name, email, created_by) values ('Client Eight', 'client8@example.test', $1)",
      [ADMIN],
    );
    await expect(
      t.asService("update public.clients set email = ' Client1@Example.TEST ' where email = 'client8@example.test'"),
    ).rejects.toThrow(/clients_email_key/);
  });

  it("адміністратор бачить усі картки клієнтів (матриця прав)", async () => {
    const rows = await t.asUser<{ email: string }>(ADMIN, "select email from public.clients where email = 'client1@example.test'");
    expect(rows).toEqual([{ email: "client1@example.test" }]);
  });

  it("новий користувач без ролі отримує найменші права: therapist, карток не бачить і не створює", async () => {
    const id = await t.createAuthUser("newcomer@example.test");
    expect(await t.asService("select role from public.profiles where id = $1", [id])).toEqual([{ role: "therapist" }]);
    expect(await t.asUser(id, "select id from public.clients")).toEqual([]);
    await expect(
      t.asUser(id, "insert into public.clients (full_name, email) values ('X', 'x9@example.test')"),
    ).rejects.toThrow(/row-level security/);
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
