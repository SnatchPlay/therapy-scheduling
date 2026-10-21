# Architecture review (quality trial)

A blind reviewer's checklist for a whole branch, run once before its PR. It asks where code belongs
and what the next developer — or the next agent — will copy.

## Read first, at the branch's base

- `AGENTS.md`, `CLAUDE.md`, `docs/decisions/` (ADRs) and the active `openspec/changes/impl-*/design.md`.
- `openspec/specs/` (the behaviour) and `requirements/` (the PM's text it translates).
- The branch's file list, untracked files included. Not the author's intent.
- `.quality-trial/known-debt.md`: report a listed item only when the branch adds to it.

## Questions

**A1 — The next-feature test.** Pick the main thing this branch adds (a table with its policies, an
RPC, a page with its action). What would a developer adding the *next* one the same way copy, edit
or extend? Every copied block that carries a rule, and every shared file that gains a branch per
feature, is a finding.

**A2 — Generic code in a feature folder.** A function, component, regex or constant in
`src/app/<feature>/` that does not mention the feature belongs in `src/lib/` or a
shared components folder.

**A3 — The layer that already owns it.** A rule enforced in a Server Action or page that a
constraint, grant, RLS policy or trigger owns (or should own: the Data API skips the action).
Presentation (labels, formatting, messages for people) decided in SQL instead of the UI.

**A4 — One source of truth.** A status, message text, time zone, duration or role list defined in
two places (SQL and TypeScript count as two).

**A5 — Names that tell the truth.** A function, view or policy named for one use but used for
another.

**A6 — Boundaries.** `SUPABASE_SECRET_KEY` or an admin client anywhere in `src/` outside a single
`src/lib/supabase/admin.ts` that starts with `import "server-only"` (none exists yet); `getSession()`
for authorization; role read from `user_metadata`; `middleware.ts` instead of `src/proxy.ts`.

**A7 — Other branches.** For every file `run.sh` lists under "files also changed by other open PRs",
read that PR's version: the same helper under another name? A migration timestamp that will land
OLDER?

## Report

Per finding: `A#` · `file:line` · what the next developer will copy or misplace · cost · the smallest
move · strongest counterargument · keep/drop. Report dropped ones with their counterargument.
