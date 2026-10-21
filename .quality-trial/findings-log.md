# Findings log (quality trial)

One short paragraph per step: what ran, what each instrument found (real / nit / noise / dropped),
decisions, what was not run, and "would a tool have caught it" where it is not obvious. Write it at
triage time. Rows also go to `analysis/findings-classified.csv` and `analysis/runs.csv`.

## 2026-10-21 · H-1 harness (this PR)

Ran: gate; `run.sh` (fallow found a clone between the two hooks — real, extracted `payload.mjs`; two
"unused files" — noise, hooks are entry points, declared in `fallow.json`; a CRAP score without
coverage — noise class, `health.maxCrap`, but it pointed at untested hooks, so `protect-files.test.ts`
was added); one blind tooling reviewer (18 findings, 18 kept). Real: stryker could never finish on this
repo (`@ts-nocheck` shifts fixture lines) — High; the specs rule of the hook blocked the template's own
archive/sync skills; `run.sh` failed open on a bad base; docs described PGlite and roles not yet on
`main`; plus 13 Low (quoting, word splitting, `gh` errors, `it.each` counting, worktree leftovers,
`--since`, case/symlink paths, nested `.env`, a test case that could not fail). Mutation check: the
openspec rule removed → its test failed (before the rule itself was dropped). Not run: stryker on a
real step (comes with task 1), CodeRabbit (after the PR opens). Would a tool have caught the High? No:
only running the script did — the reviewer ran it.
