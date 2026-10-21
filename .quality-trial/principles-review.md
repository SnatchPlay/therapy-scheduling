# Principles review (quality trial)

A blind reviewer's checklist: design principles and the failure modes AI agents are measured to
produce. Every finding carries an id below, so the findings log shows which checks earn their cost.
Not a gate.

The reviewer also applies, without restating them here:
- `.claude/skills/code-craft/SKILL.md`: search-first reuse, platform before hand-rolling, placement,
  one reason to change, fail loudly, change locality, replacement means removal, and its
  **Not a finding** list, which overrides every item below.
- `.claude/skills/self-review/checklists.md`: *Tests*, *Database & migrations*, *Auth & access*.

## How to report

For each finding: `id` · `file:line` · the defect in one sentence · the concrete cost (what breaks
or who pays, when) · the smallest fix · **the strongest counterargument**. Drop the finding when the
counterargument holds. Before raising duplication, grep the same pattern repo-wide. Read
`.quality-trial/known-debt.md` first: a listed item is reported only when this change makes it worse.
A convention is never a counterargument when it rebuilds what the platform already enforces
(PLATFORM): raise it even when AGENTS.md prescribes it.

Also report: files reviewed; for `FAIL`, the full list required below; anything skipped; and every
**dropped** finding with the counterargument that dropped it. A GUESS or CONTRACT claim is settled
with data (a scratch PGlite database with every migration, as `tests/db/` does), not by argument. Probes write
only in the scratchpad, never in the repo.

## Design principles

| Id | Question |
|---|---|
| DRY | Is one piece of *knowledge* (a rule, a limit, a status, a message text, a time zone) now owned by two places? Text that looks alike is not knowledge. |
| KISS | Is there a shorter way the reader would understand faster, with the same behaviour? Name the line count of the simpler version. |
| YAGNI | An option, parameter, flag, generic type or branch no caller uses? Error handling for a case the types, constraints or RLS already rule out? |
| SRP | Does one module now change for two unrelated reasons? |
| ISP | Does a consumer select or receive a whole row/object when it reads two fields of it? |
| DIP | Does business code construct a Supabase client, read env or call fetch where `src/lib/supabase/*` already provides it? |
| PLATFORM | Does the change re-check in TypeScript what a column constraint, a grant, RLS, a trigger or Next.js already enforces — or rebuild what the installed library offers? |
| ARCH | Code obviously in the wrong layer (rule in a page instead of the database; presentation in SQL). Placement in depth is `architecture-review.md`. |

## AI-agent failure modes

**FAIL — failure truthfulness.** List *every* `catch`, `?? <default>`, `|| <default>`, `.catch(`,
ignored `{ error }`, early `return null` / `[]`, and env-dependent branch the change adds, each with
one line: what failure it handles and why the caller may not need to know. A finding is any that
reports success after a failed write, turns a failure into the same value as a legitimate empty
result, or relaxes a check in dev only. The list is required even when every item is fine. Evidence
in this repo: pages that read `{ data }` without `error` showed "No free slots on this day." on a
failed query (slice 1 review, now the `supabase-error-ignored` ast-grep rule).

**SCOPE — out-of-scope edits.** Files or hunks the task did not need: reformatted neighbours,
renamed things, "improved" comments, side refactors, deleted code the change did not replace.

**GUESS — unstated assumptions.** A business rule, default, boundary, unit, label or ordering the
change decided without a source (the PM's AC, the spec, an ADR, an answered question). Ask: where
does this value come from? Evidence: the "started free slot is not free" assumption that decided
AC-HOLD-18 without the PM (CodeRabbit on PR #5).

**API — invented or stale library use.** A method, option or import the *installed* version does
not have, or uses differently (check `node_modules/<pkg>` and `node_modules/next/dist/docs/`, not
memory). For every optional or nullable input answer what `null`, a missing key and `undefined` do
on the real path (form → Server Action → supabase-js → PostgREST → Postgres). Run a scratch probe
instead of reasoning when the answer depends on framework behaviour.

**TEST — tests that cannot fail.** A removed or rewritten test (what pins that behaviour now?), a
weakened assertion (`toBeDefined`, `> 0`), a check that holds by construction
(`created_at + 24h − created_at = 24h`), a sequential test named after a concurrency rule, failure
paths untested while happy paths are. Evidence: the slice 1 database review found three of these.

**RACE — check-then-write.** A rule checked in one statement and enforced by a later one without a
row lock or a constraint; `now()` used after waiting on a lock. Evidence: two confirmed sessions on
one slot at the 24-hour boundary (slice 1 database review, High).

**LOAD — query shape.** A query inside a loop, an unbounded read, a per-row function in a policy on
a growing table, a second query an existing one already answers.

**DOC — claims that do not match the code.** Comments, migration headers, spec text, design.md,
ADRs and PR descriptions that say something the code does not do.

## Sources

- OWASP *Secure Coding with AI* cheat sheet (hallucinated dependencies, out-of-scope edits, test
  fabrication).
- AIRA — AI-Induced Risk Audit, arXiv 2604.17587 (2026): failure-concealment checks.
- Spracklen et al., *We Have a Package for You!*, USENIX Security 2025.
- Google engineering practices, *What to look for in a code review*.
