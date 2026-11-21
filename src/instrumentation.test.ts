import * as Sentry from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "./instrumentation";

vi.mock("@sentry/nextjs", () => ({ init: vi.fn(), captureRequestError: vi.fn() }));

describe("Sentry: що збираємо", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("вимикає збір cookie, тіл запитів, користувача, SQL і вхід та вихід моделі", () => {
    register();
    const options = vi.mocked(Sentry.init).mock.calls[0][0];
    expect(options?.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    });
    expect(options?.tracesSampleRate).toBeUndefined();
  });

  it("DSN і середовище беруться з оточення: staging відрізняється від production", () => {
    vi.stubEnv("SENTRY_DSN", "https://key@o1.ingest.sentry.io/2");
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("VERCEL_ENV", "preview");
    register();
    expect(vi.mocked(Sentry.init).mock.calls.at(-1)?.[0]).toMatchObject({ dsn: "https://key@o1.ingest.sentry.io/2", environment: "staging" });
  });
});
