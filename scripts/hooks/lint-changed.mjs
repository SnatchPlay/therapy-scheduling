// Claude Code PostToolUse hook (Edit/MultiEdit/Write): `eslint --fix` on the file just written.
// Always exits 0: formatting never blocks the agent, and a broken intermediate state just skips.
// The ESLint config decides what is ignored (--no-warn-ignored keeps ignored files quiet).
import { spawnSync } from "node:child_process";
import { editedFile } from "./payload.mjs";

const file = editedFile();
if (file === null || !/\.[cm]?[jt]sx?$/.test(file.rel)) process.exit(0);

spawnSync("npx", ["eslint", "--fix", "--no-warn-ignored", file.rel], {
  cwd: file.root,
  stdio: "ignore",
  timeout: 30000,
  shell: process.platform === "win32",
});
process.exit(0);
