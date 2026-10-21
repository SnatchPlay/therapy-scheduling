#!/usr/bin/env bash
# Mutation testing of the TypeScript a committed step changed (quality trial, not a gate).
# Usage: .quality-trial/stryker.sh [--since <ref>] <file>...   e.g. --since origin/main src/lib/time.ts src/lib/messages.ts
# --since mutates only the lines changed since <ref>: whole-file runs report survivors in code the
# step never touched. Runs in a throwaway worktree of HEAD (STRYKER_REF=<commit> for a replay), so
# the working tree is untouched and Stryker never lands in package.json.
# SQL (policies, triggers, grants) is not mutated by Stryker: for those the PR records a manual
# mutation check (remove the rule → name the test that failed), see the rls-migration skill.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
SINCE=""
if [ "${1:-}" = "--since" ]; then SINCE="$2"; shift 2; fi
[ $# -gt 0 ] || { echo "usage: $0 [--since <ref>] <file>..."; exit 1; }
WT="${TMPDIR:-/tmp}/therapy-scheduling-stryker-wt"
OUT="$ROOT/.quality-trial/last-run"

if [ -n "$SINCE" ] && ! git -C "$ROOT" rev-parse --verify -q "$SINCE^{commit}" >/dev/null; then
  echo "unknown ref for --since: $SINCE"; exit 1
fi
# A crash can leave the folder behind after git stopped tracking it as a worktree.
git -C "$ROOT" worktree remove --force "$WT" 2>/dev/null || rm -rf "$WT"
git -C "$ROOT" worktree prune
REF="${STRYKER_REF:-HEAD}"
git -C "$ROOT" worktree add --detach "$WT" "$REF" >/dev/null
trap 'git -C "$ROOT" worktree remove --force "$WT"' EXIT
cd "$WT"

MUTATE=("$@")
if [ -n "$SINCE" ]; then
  MUTATE=()
  for f in "$@"; do
    while read -r r; do MUTATE+=("$f:$r"); done < <(git diff -U0 "$SINCE"...HEAD -- "$f" |
      sed -nE 's/^@@ -[0-9,]+ \+([0-9]+)(,([0-9]+))? @@.*/\1 \3/p' |
      awk '{ n = ($2 == "") ? 1 : $2; if (n > 0) print $1 "-" ($1 + n - 1) }')
  done
  [ ${#MUTATE[@]} -gt 0 ] || { echo "no lines changed since $SINCE in: $*"; exit 0; }
  echo "mutating ${MUTATE[*]}"
fi
npm ci --ignore-scripts --no-audit --no-fund >/dev/null
npm i -D --no-save --ignore-scripts --no-audit --no-fund @stryker-mutator/core@10 >/dev/null
node -e '
const files = process.argv.slice(1);
require("fs").writeFileSync("stryker.config.json", JSON.stringify({
  // Not @stryker-mutator/vitest-runner: with Vitest 5 it never activates a mutant (it still sets the
  // removed test.poolOptions), so every mutant "survives" even a unit test that calls the code directly.
  // The command runner runs the whole suite once per mutant: slower, but each verdict is real.
  testRunner: "command",
  commandRunner: { command: "npx vitest run --reporter=dot" },
  mutate: files,
  reporters: ["clear-text", "json"],
  jsonReporter: { fileName: "reports/mutation.json" },
  // PGlite tests slow down under load: a short timeout reports a mutant as Timeout, not as killed by a test.
  concurrency: 2,
  timeoutMS: 120000,
  coverageAnalysis: "off",
  // Stryker otherwise prepends // @ts-nocheck to every TS file in its sandbox, fixtures included,
  // which shifts the line numbers tests/scripts/check-spec.test.ts asserts: the dry run fails.
  disableTypeChecks: false
}, null, 2));' "${MUTATE[@]}"
mkdir -p "$OUT"
if ! npx stryker run > "$OUT/stryker.log" 2>&1; then
  tail -40 "$OUT/stryker.log"; echo "== stryker failed: full log in $OUT/stryker.log"; exit 1
fi
grep -E '^(All files| [a-z].*\|)|% Mutation|Done in' "$OUT/stryker.log" || true

cp reports/mutation.json "$OUT/stryker.json"
node -e '
const r = require(process.argv[1]); let killed = 0, timeouts = 0, all = 0;
for (const v of Object.values(r.files)) for (const m of v.mutants) { all++; if (m.status === "Killed") killed++; if (m.status === "Timeout") timeouts++; }
console.log(`\n== killed ${killed} of ${all}` + (timeouts ? `; ${timeouts} timed out (not counted: rerun with fewer files)` : ""));
if (all && !killed) console.log(`== RUN NOT TRUSTED: 0 of ${all} mutants killed, the tests probably did not run`);' "$OUT/stryker.json"
echo
echo "== not killed (triage each: test gap, dead branch, equivalent mutant; a survivor that a"
echo "   hand-applied mutant kills is a tool artefact: count it apart)"
node -e '
const r = require(process.argv[1]);
for (const [f, v] of Object.entries(r.files))
  for (const m of v.mutants)
    if (m.status === "Survived" || m.status === "NoCoverage" || m.status === "Timeout") {
      const line = v.source.split("\n")[m.location.start.line - 1].trim();
      console.log(`  ${m.status} ${f}:${m.location.start.line} ${m.mutatorName}: ${line.slice(0, 80)} => ${(m.replacement ?? "").slice(0, 40)}`);
    }' "$OUT/stryker.json"
