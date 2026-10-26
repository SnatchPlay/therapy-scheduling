import path from "node:path";
import { describe, expect, it } from "vitest";
import { fixtures, repoRoot, runScript } from "./run-script";

const dir = (name: string) => path.join(fixtures, "action-auth", name);
const run = (name: string) => runScript("check-action-auth.mjs", dir(name), {});

describe("scripts/check-action-auth.mjs", () => {
  it("passes actions whose first statement checks the session: types with object literals, `$` names, aliases, default export", () => {
    const { code, out } = run("ok");
    expect(out).toContain("server actions: 5");
    expect(code).toBe(0);
  });

  it.each([
    ["no-auth", "src/app/a/actions.ts:5", "dropEverything: першим оператором"],
    ["db-first", "sneaky: першим оператором", ""],
    ["conditional", "maybe: першим оператором", ""],
    ["not-first", "late: першим оператором", ""],
    ["helper-first", "helperFirst: першим оператором", ""],
    ["local-fake", "fake: першим оператором", ""],
    ["wrong-module", "lookalike: першим оператором", ""],
    ["twofns", "src/app/a/actions.ts:5", "bad: першим оператором"],
    ["inline", "evil: першим оператором", ""],
    ["other-login", "src/app/a/actions.ts:3", "login: першим оператором"],
  ])("fails %s: a session check that is missing, late, conditional or not the real one", (name, ...expected) => {
    const { code, out } = run(name);
    expect(code).toBe(1);
    for (const text of expected.filter(Boolean)) expect(out).toContain(text);
  });

  it("fails exports that cannot be checked: const arrow, export { }, export *, default expression, class, enum, sync and generator functions", () => {
    const arrow = run("arrow");
    expect(arrow.code).toBe(1);
    expect(arrow.out).toContain("змінна, клас, enum чи namespace");
    expect(arrow.out).toContain("export { … } чи export *");
    expect(arrow.out).toContain("export default <вираз>");
    const exportsOut = run("exports");
    expect(exportsOut.code).toBe(1);
    expect(exportsOut.out.match(/змінна, клас, enum чи namespace/g)).toHaveLength(3);
    expect(exportsOut.out).toContain("syncOne: експорт має бути `export async function`");
    const generator = run("generator");
    expect(generator.code).toBe(1);
    expect(generator.out).toContain("stream: експорт має бути `export async function`");
  });

  it("files without \"use server\" and without an inline directive are ignored", () => {
    const { code, out } = run("ignored");
    expect(out).toContain("server actions: 0");
    expect(code).toBe(0);
  });

  it("the real repository passes", () => {
    const { code, out } = runScript("check-action-auth.mjs", repoRoot);
    expect(out).toContain("OK");
    expect(code).toBe(0);
  });

  it("exits 2 when there is nothing to check", () => {
    expect(runScript("check-action-auth.mjs", path.join(fixtures, "action-auth", "ignored", "src", "app")).code).toBe(2);
  });
});
