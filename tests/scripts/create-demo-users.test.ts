import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./run-script";

// Розбір параметрів іде до будь-яких запитів: ці тести не потребують ні мережі, ні ключів.
const run = (args: string[], env: Record<string, string> = {}) => {
  const result = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "create-demo-users.mjs"), ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    // Змінні скрипта обнулено, щоб оточення розробника не підмінило перевірку.
    env: { ...process.env, DEMO_USER_PASSWORD: "", PM_USER_PASSWORD: "", NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_SECRET_KEY: "", ...env },
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
};

describe("scripts/create-demo-users.mjs: параметри", () => {
  it("--file без --password-env відмовляє: пароль PM не має збігатися з паролем демо-акаунтів", () => {
    const { code, out } = run(["--file", "supabase/pm-users.json"], { DEMO_USER_PASSWORD: "demo-password-1" });
    expect(code).toBe(2);
    expect(out).toContain("потрібен і --password-env");
  });

  it("невідомий прапор і форма --file=… відмовляють, а не ігноруються", () => {
    expect(run(["--fil", "x"]).code).toBe(2);
    const equals = run(["--file=supabase/pm-users.json"]);
    expect(equals.code).toBe(2);
    expect(equals.out).toContain("--password-env");
  });

  it("--password-env без значення відмовляє з поясненням", () => {
    const { code, out } = run(["--password-env"]);
    expect(code).toBe(2);
    expect(out).toContain("Некоректні параметри");
  });

  it("змінна з паролем назвою вказаного списку не задана — повідомлення з її іменем, до мережі не доходить", () => {
    const { code, out } = run(["--file", "supabase/pm-users.json", "--password-env", "PM_USER_PASSWORD"], {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
      SUPABASE_SECRET_KEY: "sb_secret_test",
    });
    expect(code).toBe(1);
    expect(out).toContain("Не задано: PM_USER_PASSWORD");
  });

  it("список користувачів зі шляху (відносного й абсолютного) і лише адреси *@example.test", () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_SECRET_KEY: "sb_secret_test", PM_USER_PASSWORD: "x" };
    // Пароль коротший за 8 символів: скрипт зупиняється на ньому, але шлях до файлу вже розібрано.
    expect(run(["--file", "supabase/pm-users.json", "--password-env", "PM_USER_PASSWORD"], env).out).toContain("PM_USER_PASSWORD має бути не коротшим за 8");
    expect(run(["--file", path.join(repoRoot, "supabase", "pm-users.json"), "--password-env", "PM_USER_PASSWORD"], env).out).toContain(
      "не коротшим за 8",
    );
  });

  it("список із адресою поза *@example.test відхиляється до будь-яких запитів", () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "users-")), "bad-users.json");
    writeFileSync(file, JSON.stringify([{ email: "someone@gmail.com", full_name: "Real Person", role: "admin" }]));
    const { code, out } = run(["--file", file, "--password-env", "PM_USER_PASSWORD"], {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
      SUPABASE_SECRET_KEY: "sb_secret_test",
      PM_USER_PASSWORD: "long-enough-password",
    });
    expect(code).toBe(1);
    expect(out).toContain("Лише синтетичні адреси *@example.test");
    expect(out).toContain("someone@gmail.com");
  });

  it("список без ключа role відхиляється (null — явно «без ролі»)", () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "users-")), "no-role-key.json");
    writeFileSync(file, JSON.stringify([{ email: "x@example.test", full_name: "X" }]));
    const { code, out } = run(["--file", file, "--password-env", "PM_USER_PASSWORD"], {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:9",
      SUPABASE_SECRET_KEY: "sb_secret_test",
      PM_USER_PASSWORD: "long-enough-password",
    });
    expect(code).toBe(1);
    expect(out).toContain("не вказано role");
  });
});
