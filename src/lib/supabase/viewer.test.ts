import { beforeEach, describe, expect, it, vi } from "vitest";

// Хто увійшов: фейковий Supabase з getClaims і профілем; redirect кидає адресу, як у Next.
let claims: { sub: string; email: string } | null = null;
let profile: { email: string; full_name: string; role: string | null } | null = null;
let profileError: { message: string } | null = null;
// Що саме спитали в бази: таблиця, колонки, фільтр.
let profileQuery: string[] = [];
const supabase = {
  auth: { getClaims: async () => ({ data: claims ? { claims } : null }) },
  from: (table: string) => ({
    select: (columns: string) => ({
      eq: (column: string, value: string) => ({
        maybeSingle: async () => {
          profileQuery = [table, columns, column, value];
          return { data: profile, error: profileError };
        },
      }),
    }),
  }),
};
vi.mock("./server", () => ({ createClient: async () => supabase }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));

const { requireRole, getViewer, ALL_ROLES, STAFF } = await import("./viewer");

beforeEach(() => {
  claims = { sub: "u1", email: "user@example.test" };
  profile = { email: "user@example.test", full_name: "User", role: "therapist" };
  profileError = null;
  profileQuery = [];
});

describe("getViewer", () => {
  it("AC-CARD-07: без сесії — на сторінку входу", async () => {
    claims = null;
    await expect(getViewer()).rejects.toThrow("REDIRECT /login");
  });

  it("AC-CARD-11: профіль без ролі дає role = null, а невідома роль — теж без ролі", async () => {
    profile = { email: "newuser1@example.test", full_name: "New", role: null };
    expect((await getViewer()).role).toBeNull();
    profile = { email: "x@example.test", full_name: "X", role: "superuser" };
    expect((await getViewer()).role).toBeNull();
  });
});

describe("getViewer: звідки роль і email", () => {
  it("AC-CARD-05: роль того, хто відкриває картку (терапевт), береться з profiles за id користувача з сесії, а не з будь-якого рядка", async () => {
    expect((await getViewer()).role).toBe("therapist");
    expect(profileQuery).toEqual(["profiles", "email, full_name, role", "id", "u1"]);
  });

  it("AC-CARD-11: користувач без рядка профілю — без ролі, а не збій; email тоді з сесії", async () => {
    profile = null;
    expect(await getViewer()).toMatchObject({ role: null, email: "user@example.test" });
    await expect(requireRole(...ALL_ROLES)).rejects.toThrow("REDIRECT /");
  });

  it("email у шапці: з профілю, інакше з сесії, інакше немає", async () => {
    profile = { email: "profile@example.test", full_name: "P", role: "therapist" };
    expect((await getViewer()).email).toBe("profile@example.test");
    profile = { email: null as unknown as string, full_name: "P", role: "therapist" };
    expect((await getViewer()).email).toBe("user@example.test");
    claims = { sub: "u1", email: undefined as unknown as string };
    expect((await getViewer()).email).toBeNull();
  });
});

describe("getViewer: збій бази", () => {
  it("помилка читання профілю — помилка, а не «ролі немає» (інакше збій став б відмовою в доступі)", async () => {
    profile = null;
    profileError = { message: "connection lost" };
    await expect(getViewer()).rejects.toEqual({ message: "connection lost" });
  });
});

describe("requireRole", () => {
  it("AC-CARD-11: користувач без ролі за прямим посиланням потрапляє на головну (там лише повідомлення), не на сторінку з даними", async () => {
    profile = { email: "newuser1@example.test", full_name: "New", role: null };
    await expect(requireRole(...ALL_ROLES)).rejects.toThrow("REDIRECT /");
    await expect(requireRole(...STAFF)).rejects.toThrow("REDIRECT /");
  });

  it("роль поза списком — на головну, роль зі списку — далі", async () => {
    await expect(requireRole(...STAFF)).rejects.toThrow("REDIRECT /");
    expect((await requireRole(...ALL_ROLES)).role).toBe("therapist");
  });
});
