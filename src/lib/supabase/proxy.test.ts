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
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
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

  it("AC-INS-06: без входу картка клієнта за прямим посиланням веде лише на сторінку входу — ні статусу страхування, ні даних клієнта у відповіді", async () => {
    // Статус показує сторінка картки, а вона без сесії не відкривається: відповідь — перенаправлення без тіла.
    const response = await open("/clients/6f1c2b1e-0d5a-4f3e-9a6b-3c2f1d9e8a77?msg=INSURANCE_SAVED");
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/login");
    const body = await response.text();
    expect(body).not.toContain("Insurance");
    expect(body).not.toContain("Client");
  });

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
