# Validation rules

How a change in this repo is proven before it is committed and before its PR. The `self-review`
skill (`.claude/skills/self-review/`) loads this file; where they differ, this file wins.

## Gate (every commit)

| Command | What it proves |
|---|---|
| `npm run lint` | ESLint, 0 warnings |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Vitest: unit tests, script tests and — once a slice adds them — database tests on PGlite with every migration (`tests/db/`) |
| `npm run build` | the app builds; output shows `ƒ Proxy (Middleware)` |
| `npm run spec:validate`, `npm run spec:check` | OpenSpec strict; denylist and spec format |
| `npm run ac:coverage` | AC → scenario → test → conformance row |
| `node scripts/check-migration-order.mjs` | a new migration is newer than `origin/main`; applied files unchanged |

A database change is exercised on PGlite (`tests/db/supabase-pglite.ts`, added with the first slice that has
tables), never by applying it to the cloud project:
the cloud database changes only through `db-deploy` after the merge.

## Review areas (self-review, blind, split when the change is large)

| Area | Files | Checklists |
|---|---|---|
| Database & access | `supabase/**`, `tests/db/**` | self-review *Database & migrations*, *Auth & access*, *Tests*; `rls-migration` skill |
| App code & UI | `src/**`, `tests/**` outside `tests/db` | self-review *Auth & access*, *Data access & API contract*, *UI*, *Tests* |
| Spec | `openspec/**`, `docs/conformance.md`, `docs/spec-reading.md` | `spec-review` skill |
| CI & tooling | `.github/**`, `scripts/**`, `.claude/**`, `.quality-trial/**` | self-review *CI & workflows*, *Scripts & data fixes* |

UI changes also need the `visual-verify` skill: every role, signed out, the forbidden page by
direct URL, loading / empty / error.

## Quality trial (per step, before its local commit)

Not a gate: it measures which instrument catches what. Every finding is verified against the code
before it is believed.

1. `.quality-trial/run.sh --snapshot`, then the reviewers, then `.quality-trial/run.sh`: ast-grep
   rules on the changed files, `fallow audit` vs `origin/main` (new findings only), removed tests,
   AC coverage, deploy-readiness trigger, files also changed by other open PRs, files written since
   the snapshot.
2. When it prints `REQUIRED`: answer `.quality-trial/deploy-readiness.md` with command output.
3. Blind reviews with the step's file list (untracked included), never the intent; both read
   `.quality-trial/known-debt.md`. Over ~150 changed lines: a correctness reviewer (self-review
   areas) and a separate principles reviewer (`.quality-trial/principles-review.md`); smaller: one
   reviewer with both.
4. Mutation testing of changed TypeScript that has unit tests:
   `.quality-trial/stryker.sh --since <step base> <files>`. Triage every Survived / NoCoverage
   mutant. SQL rules get a manual mutation check recorded in the PR (rls-migration skill).
5. Log at triage time: `.quality-trial/findings-log.md`, `analysis/findings-classified.csv`,
   `analysis/runs.csv` (including runs with no findings). `python3 -I .quality-trial/analysis/analyze.py` prints
   the per-instrument tables.

## Before a branch's PR (once per branch)

1. `.quality-trial/run.sh` again (other open PRs change).
2. Architecture review: one fresh blind subagent with the branch's file list and
   `.quality-trial/architecture-review.md`.
3. `ponytail-review` (read-only).
4. After the PR opens: `@coderabbitai review` as a separate comment; answer every comment with a fix
   or a reason before merging.

## Adding an ast-grep rule

Only after it fires on a real past smell; the rule's header comment names that smell, and the rule is
tested on the code before and after the fix.
