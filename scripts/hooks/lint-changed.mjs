// Claude Code PostToolUse hook (Edit/MultiEdit/Write): `eslint --fix` on the file just written.
// Always exits 0: formatting never blocks the agent, and a broken intermediate state just skips.
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

spawnSync(process.execPath, [eslint, "--fix", "--no-warn-ignored", "--", file.rel], {
  cwd: file.root,
  stdio: "ignore",
  timeout: 30000,
});
process.exit(0);
