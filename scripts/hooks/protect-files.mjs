// Claude Code PreToolUse hook (Edit/MultiEdit/Write): block edits that the repo rules forbid.
// Exit code 2 blocks the tool call; stderr goes back to the agent. Anything unparsable passes:
// the hook guards the agent's own file tools; CI (db-check) and CodeRabbit guard the rest.
import { execFileSync } from "node:child_process";
import { editedFile } from "./payload.mjs";

const file = editedFile();
if (file === null) process.exit(0);
const { root, rel } = file;

function block(message) {
  console.error(message);
  process.exit(2);
}

if (/(^|\/)\.env(\..+)?$/.test(rel) && !rel.endsWith(".env.example")) {
  block(`${rel}: secrets are edited by the developer only (AGENTS.md, «Секрети»).`);
}

if (rel.startsWith("product/denylist.local")) {
  block(`${rel}: the local denylist holds real client names; the agent never opens or edits it.`);
}

if (/^supabase\/migrations\/[^/]+\.sql$/.test(rel)) {
  // On origin/main (as of the last fetch) means db-deploy has applied it: fix forward with a new file.
  try {
    execFileSync("git", ["cat-file", "-e", `origin/main:${rel}`], { cwd: root, stdio: "ignore" });
    block(
      `${rel} is on origin/main (last fetch), so db-deploy has applied it. Applied migrations are immutable: ` +
        "create a new one with `npx supabase migration new <name>` (rls-migration skill).",
    );
  } catch {
    // not on origin/main: an unmerged migration of this branch may still change
  }
}

process.exit(0);
