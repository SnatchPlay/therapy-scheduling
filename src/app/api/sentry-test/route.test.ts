import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRole = vi.fn();
vi.mock("@/lib/supabase/viewer", () => ({ requireRole }));

const { GET } = await import("./route");

describe("/api/sentry-test", () => {
  beforeEach(() => {
    requireRole.mockReset();
  });

  it("кидає навмисну помилку лише після перевірки ролі admin", async () => {
    requireRole.mockResolvedValue({ role: "admin" });
    await expect(GET()).rejects.toThrow("Sentry test: intentional error");
    expect(requireRole).toHaveBeenCalledWith("admin");
  });

  it("не адміністратор: відмова ролі (редирект) замість навмисної помилки", async () => {
    requireRole.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(GET()).rejects.toThrow("NEXT_REDIRECT");
  });
});
