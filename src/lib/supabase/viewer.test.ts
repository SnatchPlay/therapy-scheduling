import { beforeEach, describe, expect, it, vi } from "vitest";

// Хто увійшов: фейковий Supabase з getClaims і профілем; redirect кидає адресу, як у Next.
let claims: { sub: string; email: string } | null = null;
let profile: { email: string; full_name: string; role: string | null } | null = null;
let profileError: { message: string } | null = null;
const supabase = {
  auth: { getClaims: async () => ({ data: claims ? { claims } : null }) },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile, error: profileError }) }) }) }),
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
