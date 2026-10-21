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

## 2026-10-21 · T-1 clients (task 1 of impl-slot-hold)

Ran: gate; `run.sh` (ast-grep hit `viewer.ts` `getClaims()` — noise: an auth error leaves no claims and
the page redirects to /login, fails closed; rule now skips `auth.getClaims()`, checked on a fixture:
2 real hits kept, getClaims dropped; fallow: `isMessageCode` exported but used only in its file — real,
unexported); two blind reviewers (correctness, principles). Real: whitespace-only names with tab,
newline or NBSP passed the check — Medium, fixed with an explicit Unicode list (`[:space:]` for non-ASCII
depends on the database locale; PGlite is `C`), hand mutation: old `btrim` check back → AC-HOLD-11
failed; sign-out lost for therapists on the home page (regression); staff roles copied in 4 places
(`STAFF` now); the migration mapped `member` to `therapist` against design Р1 (now `scheduler`, as
designed); order-dependent DB tests (self-seeding now, `--sequence.shuffle` green); forged
`created_by` untested (test added); a false header comment; dead `?? []`; no error boundary or empty
state (added). Mutation: the first stryker runs were **not trusted**: 0 killed, then "killed" that were
timeouts. Cause: `@stryker-mutator/vitest-runner` (9 and 10) never activates a mutant under Vitest 5
(it still sets the removed `test.poolOptions`): a hand-applied surviving mutant failed 2 tests. Fixed
`stryker.sh`: command runner, `coverageAnalysis: off`, timeouts reported apart. Control run on the
commit without unit tests: 11 of 28 killed (the DB tests reach `clientErrorCode` only through two
constraint paths); with `messages.test.ts`: 27 of 28, the survivor is equivalent (`?? ""` →
`?? "Stryker was here!"`: neither matches the constraint regex). Not tested: `createClientCard`
(a thin insert + redirect; the DB tests run the same insert) — checked on the preview after merge.
Would a tool have caught it? The NBSP case and the role drift: no — reading did; the tool defect:
only the hand-applied mutant showed it.

Deploy readiness (REQUIRED: migration, `package.json`):
1. `db-deploy` after merge only. Deployed `main` reads only `profiles`; the new `profiles_role_check`
   accepts every role it can meet (item 4).
2. New code before `db-deploy` ends: `/clients` fails on the missing table → `error.tsx` shows
   "Something went wrong. Try again." for that minute. Old code on the new schema: unaffected.
3. `node scripts/check-migration-order.mjs` → "нових міграцій 1, усі новіші за 20261012000000
   (origin/main); застосовані міграції не змінено".
4. Existing rows (`docs/bootstrap.md` §5: admin, member1, member2): `member` → `scheduler` before the
   new check; `admin` stays valid. `clients` is new: no rows.
5. Explicit: `revoke all` + `grant select`, column `grant insert (full_name, email)` to
   `authenticated`, `service_role` grants; `private.is_scheduler_or_admin()` revoked from public/anon.
6. `database.types.ts` is still hand-written (known debt) — copied from this PR's `db-check` summary.
7. No new env names (`git diff main -- .env.example` empty; no new `process.env` in `src`).
8. `npm run build` → `ƒ /clients`, `ƒ Proxy (Middleware)`.
9. `demo-users.json`: scheduler1/2 and therapist1/2 replace member1/2 → `npm run users:demo` after
   merge (a write to the cloud project: ask first).
10. Red `db-deploy`; `/clients` shows the error boundary.
11. Revert the code by PR; the schema goes forward: a migration that drops `clients` (its rows are lost)
    and restores the old role check after mapping `scheduler`/`therapist` back.

Self-review (two blind reviewers on the whole branch, after the fixes above). Database: an email with a
trailing NBSP was stored as a new client — Medium, real (the trigger's `btrim` and the check's `[:space:]`
miss non-ASCII spaces); now one list `private.blank_chars()` feeds the name check, the email check and
the trim. Two overlapping helper calls on PGlite ran under the last user's `auth.uid()` — Medium, real
(reproduced: a therapist insert passed as the scheduler); `db.transaction` now, regression test fails
on the old helper. Low, real: zero-width-only names (list extended); no test of the default role, the
admin read, update normalization (tests added); no `lock_timeout` (added). Hand mutations, each turned a
test red: trigger back to insert-only; default `scheduler`; NBSP dropped from the list; trim back to
ASCII spaces. App: the server action had no test — Medium, real (`actions.test.ts`; hand mutations:
no throw on UNEXPECTED, swapped field, wrong roles — each red); UNEXPECTED errors were swallowed —
Medium, real (thrown now: server log + `error.tsx`); the getClaims exemption hid a `Promise.all` that
mixes it with a query — Low, real (exact statement now, checked on the reviewer's probe); the error page
had no sign-out — Low, real (added). Left open (known-debt): orphan member1/2 accounts, UI language,
form state after an error, design.md Р2 wording. Hand-written `database.types.ts`: replaced from the
`db-check` summary of this PR.

Stryker after the self-review fixes (`--since main`, command runner): `actions.ts` + `messages.ts` —
42 of 47 killed; 4 real test gaps in `actions.test.ts` (table name, empty form fields, revalidated path:
the fake client ignored them), closed → `actions.ts` 19 of 19; the `messages.ts` survivor is the
equivalent `?? ""` mutant from above.

CodeRabbit (PR #12): 5 comments. Accepted: form fields must be strings (a file became "[object File]"),
table caption, index on `created_by`. Declined with evidence: `reset` instead of `retry` (wrong for Next
16.4: `retry` is stable since v16.3.0 per the bundled docs and types), client-side `console.error`
(Next's own example; production redacts server errors). Pre-merge warnings: PR boundaries (PGlite is in
the merged plan; `.quality-trial` holds only this step's records) and the select policy without a
literal `auth.uid()` (the helper already depends on it) — answered in the PR and in code comments.
`database.types.ts`: the rendered `db-check` summary drops the file's leading blank line, so a copy
from the page still differed; the file is now `supabase gen types typescript --local` (CLI 2.120.0) run on a
scratch local database, and `db-check` no longer reports a difference (run on e6cc1f0).
