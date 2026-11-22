// Дія з postmortem 2026-11-22 (docs/incidents/2026-11-22-staging-bad-supabase-url.md): smoke червоніє, коли деплой дивиться
// не на той проєкт Supabase, і зеленіє на правильному. Справжній scripts/smoke.mjs проти локального HTTP-сервера.
import { execFile } from "node:child_process";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const run = promisify(execFile);
const STAGING = "yqflnrgwjficixvqyblg";
const DRILL_REF = "yqflnrgwjficixvqyblx"; // хост з одним зміненим символом, як у дрілі

let health: Record<string, unknown>;
let healthStatus = 200;
let server: Server;
let base = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/") return void res.writeHead(307, { location: "/login" }).end();
    if (req.url === "/login") return void res.writeHead(200).end('<input type="password">');
    if (req.url === "/api/health") return void res.writeHead(healthStatus, { "content-type": "application/json" }).end(JSON.stringify(health));
    return void res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

async function smoke(expectRef: string | undefined) {
  const env = { ...process.env, EXPECT_SUPABASE_REF: expectRef ?? "", VERCEL_AUTOMATION_BYPASS_SECRET: "" };
  try {
    const { stdout } = await run(process.execPath, ["scripts/smoke.mjs", base], { env });
    return { code: 0, out: stdout };
  } catch (error) {
    const failure = error as { code: number; stdout: string };
    return { code: failure.code, out: failure.stdout };
  }
}

describe("scripts/smoke.mjs: ref проєкту Supabase", () => {
  it("зелений, коли деплой дивиться на очікуваний проєкт", async () => {
    health = { ok: true, sha: "abc", env: "preview", appEnv: "staging", supabaseRef: STAGING, db: "ok", reason: "" };
    healthStatus = 200;
    const result = await smoke(STAGING);
    expect(result.code).toBe(0);
    expect(result.out).toContain("OK");
  });

  it("червоний і називає змінну, коли база жива, але це інший проєкт (прод на базі staging)", async () => {
    health = { ok: true, sha: "abc", env: "production", appEnv: null, supabaseRef: STAGING, db: "ok", reason: "" };
    healthStatus = 200;
    const result = await smoke("iikegmyikslssdwbadwy");
    expect(result.code).toBe(1);
    expect(result.out).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(result.out).toContain(`supabaseRef=${STAGING}`);
  });

  it("червоний, як у дрілі: хибний хост (db=down, status-0) дає і збій бази, і назву змінної", async () => {
    health = { ok: false, sha: "abc", env: "preview", appEnv: "staging", supabaseRef: DRILL_REF, db: "down", reason: "status-0" };
    healthStatus = 503;
    const result = await smoke(STAGING);
    expect(result.code).toBe(1);
    expect(result.out).toContain(`supabaseRef=${DRILL_REF}`);
    expect(result.out).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("без EXPECT_SUPABASE_REF перевірки ref немає (як було до дрілу)", async () => {
    health = { ok: true, sha: "abc", env: "preview", appEnv: "staging", supabaseRef: DRILL_REF, db: "ok", reason: "" };
    healthStatus = 200;
    const result = await smoke(undefined);
    expect(result.code).toBe(0);
  });
});
