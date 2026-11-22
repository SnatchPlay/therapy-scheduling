// D0: /api/health відрізняє «база відповіла» від «база недоступна, призупинена чи ключ хибний».
import { afterEach, describe, expect, it, vi } from "vitest";
import { appEnv, classifyDbProbe, supabaseRefFromUrl } from "@/lib/health";

describe("classifyDbProbe (/api/health)", () => {
  it("рахує базу живою, коли запит пройшов або Postgres відмовив у правах (42501)", () => {
    expect(classifyDbProbe({ status: 200, error: null })).toEqual({ db: "ok", reason: "" });
    expect(classifyDbProbe({ status: 401, error: { code: "42501", message: "permission denied for table profiles" } })).toEqual({
      db: "ok",
      reason: "",
    });
    expect(classifyDbProbe({ status: 400, error: { code: "PGRST100", message: "bad filter" } }).db).toBe("ok");
  });

  it("повідомляє «paused», коли Supabase відповідає 540 (безкоштовний проєкт призупинено)", () => {
    expect(classifyDbProbe({ status: 540, error: { message: "project paused" } })).toEqual({ db: "down", reason: "paused" });
  });

  it("повідомляє про хибний публічний ключ", () => {
    expect(classifyDbProbe({ status: 401, error: { message: "Invalid API key" } })).toEqual({
      db: "down",
      reason: "invalid-api-key",
    });
  });

  it("повідомляє код, коли PostgREST не дістає до бази або мережі немає", () => {
    expect(classifyDbProbe({ status: 503, error: { code: "PGRST002", message: "schema cache" } })).toEqual({
      db: "down",
      reason: "status-503-PGRST002",
    });
    expect(classifyDbProbe({ status: 0, error: { message: "fetch failed" } })).toEqual({ db: "down", reason: "status-0" });
  });
});

describe("supabaseRefFromUrl (/api/health, supabaseRef)", () => {
  it("бере ref — перший сегмент хоста адреси проєкту", () => {
    expect(supabaseRefFromUrl("https://abcdefghijklmnop.supabase.co")).toBe("abcdefghijklmnop");
    expect(supabaseRefFromUrl("https://abcdefghijklmnop.supabase.co/")).toBe("abcdefghijklmnop");
  });

  it("повертає null, коли змінної немає або це не адреса з доменом", () => {
    expect(supabaseRefFromUrl(undefined)).toBeNull();
    expect(supabaseRefFromUrl("")).toBeNull();
    expect(supabaseRefFromUrl("not a url")).toBeNull();
    expect(supabaseRefFromUrl("http://localhost:54321")).toBeNull();
  });
});

describe("appEnv (/api/health і Sentry: одне правило середовища)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("повертає APP_ENV без пробілів, а порожню чи відсутню змінну вважає відсутньою", () => {
    vi.stubEnv("APP_ENV", " staging ");
    expect(appEnv()).toBe("staging");
    vi.stubEnv("APP_ENV", "  ");
    expect(appEnv()).toBeNull();
    vi.stubEnv("APP_ENV", "");
    expect(appEnv()).toBeNull();
  });
});
