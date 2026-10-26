import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Проксі без Supabase: createServerClient повертає лише getClaims — сесія є чи ні.
let claims: unknown = null;
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: claims ? { claims } : null }) } }),
}));

const { updateSession } = await import("./proxy");
const open = (path: string) => updateSession(new NextRequest(`http://localhost${path}`));

beforeEach(() => {
  claims = null;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
});

describe("updateSession", () => {
  it.each(["/clients", "/clients/new", "/clients/c6", "/holds", "/slots", "/schedule", "/"])(
    "AC-CARD-07: без входу %s веде на сторінку входу, дані не показуються",
    async (path) => {
      const response = await open(path);
      expect(response.status).toBe(307);
      expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
    },
  );

  it("AC-CARD-07: сторінка входу доступна без входу", async () => {
    const response = await open("/login");
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("із сесією сторінки не перенаправляють", async () => {
    claims = { sub: "u1" };
    const response = await open("/clients");
    expect(response.headers.get("location")).toBeNull();
  });
});
