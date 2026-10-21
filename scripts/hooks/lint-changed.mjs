// Claude Code PostToolUse hook (Edit/MultiEdit/Write): `eslint --fix` on the file just written.
// Lint findings never block the agent (a broken intermediate state just stays unfixed); only a failure
// to start ESLint is reported.
// The ESLint config decides what is ignored (--no-warn-ignored keeps ignored files quiet).
// ESLint runs through node directly, without a shell: the file name never reaches cmd.exe or sh.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { editedFile } from "./payload.mjs";

const file = editedFile();
if (file === null || !/\.[cm]?[jt]sx?$/.test(file.rel)) process.exit(0);
const eslint = path.join(file.root, "node_modules", "eslint", "bin", "eslint.js");
if (!existsSync(eslint)) process.exit(0);

const result = spawnSync(process.execPath, [eslint, "--fix", "--no-warn-ignored", "--", file.rel], {
  cwd: file.root,
  stdio: "ignore",
  timeout: 30000,
});
if (result.error) {
  // ESLint did not start or timed out: say so (PostToolUse exit 1 is shown, it does not block).
  console.error(`lint-changed: ESLint не запустився для ${file.rel}: ${result.error.message}`);
  process.exit(1);
}
process.exit(0);
