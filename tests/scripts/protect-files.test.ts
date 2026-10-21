import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { repoRoot } from "./run-script";

// Хук PreToolUse: тимчасовий git-репозиторій, де одна міграція вже в origin/main (застосована).
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.test", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    stdio: "ignore",
  });

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), "protect-files-"));
  mkdirSync(path.join(dir, "supabase", "migrations"), { recursive: true });
  writeFileSync(path.join(dir, "supabase", "migrations", "20261012000000_applied.sql"), "select 1;\n");
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", ".");
  git(dir, "commit", "-q", "-m", "main");
  git(dir, "update-ref", "refs/remotes/origin/main", "HEAD");
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

function hook(input: string) {
  const r = spawnSync(process.execPath, [path.join(repoRoot, "scripts", "hooks", "protect-files.mjs")], {
    input,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
  });
  return { code: r.status, err: r.stderr };
}
const edit = (rel: string) => hook(JSON.stringify({ tool_input: { file_path: path.join(dir, rel) } }));

describe("protect-files", () => {
  it.each([
    ["supabase/migrations/20261012000000_applied.sql", "immutable"],
    [".env", "secrets"],
    [".env.local", "secrets"],
    ["supabase/.env", "secrets"],
    ["product/denylist.local.txt", "denylist"],
  ])("блокує %s", (rel, reason) => {
    const r = edit(rel);
    expect(r.code).toBe(2);
    expect(r.err).toContain(reason);
  });

  it.each([
    "supabase/migrations/20991231000000_unmerged.sql",
    ".env.example",
    "src/app/page.tsx",
    "requirements/product.md",
    "openspec/specs/slot-holds/spec.md",
  ])("пропускає %s", (rel) => {
    expect(edit(rel).code).toBe(0);
  });

  it("блокує відносний шлях і payload MultiEdit", () => {
    expect(hook(JSON.stringify({ tool_input: { file_path: ".env.local" } })).code).toBe(2);
    const multi = { tool_input: { file_path: path.join(dir, "supabase/migrations/20261012000000_applied.sql"), edits: [] } };
    expect(hook(JSON.stringify(multi)).code).toBe(2);
  });

  it.runIf(process.platform === "darwin")("блокує застосовану міграцію, названу іншим регістром (APFS)", () => {
    expect(edit("SUPABASE/migrations/20261012000000_APPLIED.sql").code).toBe(2);
  });

  it("не діє на файли іншого git-репозиторію", () => {
    const other = mkdtempSync(path.join(os.tmpdir(), "protect-files-other-"));
    git(other, "init", "-q");
    try {
      expect(hook(JSON.stringify({ tool_input: { file_path: path.join(other, ".env.local") } })).code).toBe(0);
    } finally {
      rmSync(other, { recursive: true, force: true });
    }
  });

  it("пропускає payload, який не розібрати", () => {
    expect(hook("not json").code).toBe(0);
    expect(hook(JSON.stringify({ tool_input: {} })).code).toBe(0);
  });
});
