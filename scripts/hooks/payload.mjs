// Shared input of the Claude Code file hooks: the edited file as a path relative to the git root of
// the file itself (realpath, so symlinks and macOS letter case resolve to the real name), or null
// when there is nothing to check: unparsable payload, no file_path, or a file outside a git repo.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

function realExisting(p) {
  // The file may not exist yet (Write creates it): resolve the nearest existing ancestor.
  let dir = p;
  const rest = [];
  while (!existsSync(dir)) {
    rest.unshift(path.basename(dir));
    const parent = path.dirname(dir);
    if (parent === dir) return p;
    dir = parent;
  }
  return path.join(realpathSync.native(dir), ...rest);
}

export function editedFile() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return null;
  }
  const filePath = payload?.tool_input?.file_path;
  if (typeof filePath !== "string" || filePath.length === 0) return null;
  const base = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const abs = realExisting(path.resolve(base, filePath));
  let dir = path.dirname(abs);
  while (!existsSync(dir) && path.dirname(dir) !== dir) dir = path.dirname(dir);
  let root;
  try {
    root = realpathSync.native(
      execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
    );
  } catch {
    return null;
  }
  return { root, rel: path.relative(root, abs).split(path.sep).join("/") };
}
