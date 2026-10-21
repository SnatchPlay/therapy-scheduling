#!/usr/bin/env bash
# Quality trial: what each instrument reports on this branch. Not a gate: nothing blocks a commit;
# every finding is triaged against the code and logged (docs/reference/validation.md).
# Usage: .quality-trial/run.sh [base-ref]   (default: origin/main)
#        .quality-trial/run.sh --snapshot   before launching reviewers; the next run lists files changed since
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
OUT=".quality-trial/last-run"
mkdir -p "$OUT"
# Hash of every dirty or untracked file: shows a reviewer or a formatter writing into the repo.
# NUL-separated, so paths with spaces or non-ASCII names are hashed, not quoted; renames give the new path.
dirty_hashes() {
  git -c core.quotePath=false status --porcelain -z -uall | while IFS= read -r -d '' entry; do
    case "$entry" in R*|C*) IFS= read -r -d '' _ ;; esac
    f="${entry:3}"
    printf '%s\t%s\n' "$f" "$( [ -f "$f" ] && git hash-object -- "$f" || echo deleted)"
  done | sort
}
if [ "${1:-}" = "--snapshot" ]; then
  dirty_hashes > "$OUT/status.before"
  echo "snapshot of $(wc -l < "$OUT/status.before" | tr -d ' ') dirty files in $OUT/status.before"
  exit 0
fi
BASE="${1:-origin/main}"
case "$BASE" in origin/*) git fetch -q origin "${BASE#origin/}" || echo "  (fetch failed: $BASE may be stale)";; esac
MB="$(git merge-base "$BASE" HEAD 2>/dev/null)" || { echo "cannot resolve the base $BASE: nothing was checked" >&2; exit 1; }
CHANGED="$( { git -c core.quotePath=false diff --name-only "$MB"; git -c core.quotePath=false ls-files --others --exclude-standard; } | grep -v '^\.quality-trial/last-run/' | sort -u)"
sg() { npx -y -p @ast-grep/cli@0.45 ast-grep "$@" 2>&1 | grep -v "npm warn"; }
fallow() { npx -y fallow@3.30.0 "$@" 2>/dev/null; }

echo "== ast-grep (rules in .quality-trial/ast-grep/rules, changed files only)"
SG_FILES=(); while read -r f; do [ -f "$f" ] && SG_FILES+=("$f"); done < <(printf '%s\n' "$CHANGED" | grep -E '^(src|scripts)/.*\.(ts|tsx)$')
: > "$OUT/ast-grep.txt"
[ ${#SG_FILES[@]} -gt 0 ] && sg scan -c .quality-trial/sgconfig.yml --report-style short "${SG_FILES[@]}" | tee "$OUT/ast-grep.txt"
[ -s "$OUT/ast-grep.txt" ] || echo "  no hits"

echo
echo "== fallow audit vs $BASE (new findings in changed files)"
fallow audit --base "$BASE" -c "$PWD/.quality-trial/fallow.json" --format json > "$OUT/fallow-audit.json"
if [ -s "$OUT/fallow-audit.json" ]; then
node -e '
const j = require(process.argv[1]);
const rows = [];
const walk = (o, p) => {
  if (Array.isArray(o)) return o.forEach((x) => walk(x, p));
  if (!o || typeof o !== "object") return;
  if ("introduced" in o) {
    if (!o.introduced) return;
    const where = o.path ?? o.instances?.map((i) => `${i.file}:${i.start_line}`).join(" | ") ?? "";
    rows.push(`  NEW ${p} ${where} ${o.export_name ?? o.name ?? o.package_name ?? ""}`);
    return;
  }
  for (const k in o) walk(o[k], p ? `${p}.${k}` : k);
};
walk(j, "");
console.log(`  verdict: ${j.verdict ?? j.summary?.verdict}`);
console.log(rows.length ? rows.join("\n") : "  no new findings");
' "$PWD/$OUT/fallow-audit.json"
else
  echo "  fallow produced no output: not checked"
fi
echo "  Before acting on an unused export or a clone, check the same pattern repo-wide:"
echo "  npx fallow@3.30.0 dead-code | grep <Name>   (audit sees changed files only)"

echo
echo "== tests removed vs $BASE (each needs a reason: the behaviour went, or another test pins it)"
git diff "$MB" -U0 -- '*.test.ts' '*.test.tsx' | awk '
/^--- /{old=substr($2,3)}
/^\+\+\+ /{f=($2=="/dev/null")?old:substr($2,3)}
/^-[[:space:]]*(it|test)(\.each)?\(/ {r[f]++; t[f]=t[f] "\n      " substr($0,2)}
/^\+[[:space:]]*(it|test)(\.each)?\(/ {a[f]++}
/^-.*expect\(/ {re[f]++}
/^\+.*expect\(/ {ae[f]++}
END {
  for (k in r) { n++; printf "  %s: -%d/+%d tests, -%d/+%d expect%s\n", k, r[k], a[k]+0, re[k]+0, ae[k]+0, t[k] }
  if (!n) print "  none"
}'

echo
echo "== AC IDs in test titles vs the spec (renamed or orphaned AC show up here before conformance does)"
npm run -s ac:coverage 2>&1 | tail -3 | sed 's/^/  /'

echo
echo "== deploy readiness"
DEPLOY_PATHS='^supabase/(migrations/|seed\.sql$|config\.toml$)|^\.github/workflows/|next\.config\.|^vercel\.json$|(^|/)package(-lock)?\.json$|\.env\.example$|^src/proxy\.ts$|^src/lib/supabase/|^supabase/demo-users\.json$'
hits="$(printf '%s\n' "$CHANGED" | grep -E "$DEPLOY_PATHS")"
if [ -n "$hits" ]; then
  echo "  REQUIRED: answer .quality-trial/deploy-readiness.md with evidence. Triggered by:"
  printf '%s\n' "$hits" | sed 's/^/    /'
else
  echo "  not triggered"
fi

echo
echo "== files also changed by other open PRs (duplicate work or conflicts)"
GENERATED='src/lib/supabase/database\.types\.ts$|package-lock\.json$'
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if PRS="$(gh pr list --state open --limit 50 --json number,title,author,headRefName,files 2>/dev/null)"; then
  PRS="$PRS" CHANGED="$CHANGED" node -e '
const prs = JSON.parse(process.env.PRS);
const [branch, generated] = process.argv.slice(1);
const changed = process.env.CHANGED.split("\n");
const mine = new Set(changed.filter((f) => f && !new RegExp(generated).test(f)));
let n = 0;
for (const pr of prs) {
  if (pr.headRefName === branch) continue;
  const shared = pr.files.map((f) => f.path).filter((p) => mine.has(p));
  if (!shared.length) continue;
  n++;
  console.log(`  #${pr.number} ${pr.title} (${pr.author.login}):`);
  for (const p of shared) console.log(`    ${p}`);
}
if (!n) console.log("  none");
' "$BRANCH" "$GENERATED"
else
  echo "  gh unavailable: not checked"
fi

echo
echo "== files changed since the snapshot (run.sh --snapshot before the reviews)"
if [ -f "$OUT/status.before" ]; then
  comm -13 "$OUT/status.before" <(dirty_hashes) | cut -f1 | sed 's/^/  /'
  echo "  (each one: my fix of a finding, or a reviewer / formatter writing where it should not)"
else
  echo "  no snapshot taken"
fi
