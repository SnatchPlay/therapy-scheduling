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

## 2026-10-21 · T-2 slots and holds (task 2 of impl-slot-hold)

Ran: gate; `run.sh`; two blind reviewers (database, app; the database one stopped on a usage limit and was
resumed); mutation checks of the SQL by hand; the race on real Postgres 17 (Docker); stryker.
Real, database: the therapist branch of `holds_select` and the expiry filter were untested — mutating
either left 25/25 green (Medium; negative tests added, mutations now red); both therapist policies called a
security-definer helper per row (Medium; `EXPLAIN` showed it ran before the cheap initplan, so every
staff read of `clients` paid for it): now set-based subqueries, helpers removed; the 24-hour boundary
was never read at exactly 1440 minutes (`>=` → `>` stayed green; tests now call `hold_status` at
explicit instants); `created_at` kept seconds while the PM counts to the minute (a hold at 14:30:45
stayed "Held" after the displayed 14:30; now `date_trunc('minute')`); the AC-HOLD-02 test held by
construction (an hour-early `created_at` stayed green; now checked against the minute before and after
the call); fixed 2027 dates would turn red from 2027-03-02 (rolling `quietDay()`).
Real, app: AC-HOLD-08's message was unreachable (the redirect to `/slots` sent a therapist to `/`
without the text) — now `/?msg=HOLD_FORBIDDEN`, tested; `required` on the client select did nothing
(empty first option); `isIsoDate("0000-01-01")` passed and `day_slots` threw (rejected); the action
swallowed unexpected errors (thrown now); AC-HOLD-18/24 rows cited a test that compared a constant with
itself (a render test of `/slots` now checks the order and the rows); the DST/24 h time tests claimed an
AC but computed the value inside the test (renamed as formatting; the rule is tested in SQL).
Open, Low (known-debt): all clients in every form, no pending state on the button, started-but-unheld
slot vs. "No free slots" (own assumption, candidate PM question). Concurrency: by hand on Postgres 17
with two sessions: with the lock the second gets SLOT_UNAVAILABLE (1 hold); the mutant without
`for update` leaves 2 holds. Would a tool have caught the helper-per-row cost? `EXPLAIN` did; the
`rls-migration` skill names the pattern.

Stryker T-2 (`--since main`, 4 files): 102 of 107 killed. Survivors: `if (code === "HOLD_FORBIDDEN")` → `true` — real gap
(the AC-HOLD-03 test did not check the path), closed, mutant now red; four on `isIsoDate` — equivalent:
the regex only pre-filters, the round trip through `Date.parse` rejects the same strings.

Deploy readiness T-2 (REQUIRED: migration, types): 1. `db-deploy` after merge only; deployed `main` never reads the new
tables, `clients` gets one more policy (staff reads unchanged: `clients_select_staff`). 2. New code before `db-deploy`
ends: `/slots` fails on the missing tables → `error.tsx`; old code on the new schema: unaffected. 3. migration order OK
(`check-migration-order.mjs`). 4. Existing rows: the migration only adds tables, a policy and seed rows
(`on conflict do nothing`); users from `users:demo` untouched. 5. Explicit grants for `therapists`, `slots`, `holds`,
both views and both functions; `revoke … from anon` checked by the anon test. 6. `database.types.ts` is
`supabase gen types --local` of this schema. 7. No new env names; no dependency changes. 8. `npm run build` shows
`ƒ /slots` and `ƒ Proxy (Middleware)`. 9. `demo-users.json` unchanged: therapist1/2 already exist in the cloud project
(2026-10-21) — the therapist link is by email. 10. A red `db-deploy`; `/slots` shows the error boundary. 11. Revert
the code by PR; the schema goes forward: a migration dropping `holds`, `slots`, `therapists` and the policy (the holds are lost).

CodeRabbit (PR #13): 1 inline comment — accepted (the client `select` in each slot row had no accessible name;
`aria-label` with the slot time, asserted in the page test). Pre-merge warnings: PR type (records of this step in
`.quality-trial/`, same as PR #12) and "no `(select auth.uid())` in the read policies" — answered in the PR and with
a comment over the policies (both branches already depend on `auth.uid()`, anon has no grant, tested).

## 2026-10-21 · T-3 confirm holds (task 3 of impl-slot-hold)

Ran: gate; `run.sh`; blind reviewers (database, app); two races on real Postgres 17 (Docker), on the final migration:
(1) two confirms of one hold, the first keeps its transaction 3 s — the second gets SLOT_UNAVAILABLE, 1 confirmed hold;
(2) an expired hold H1, session B holds the slot (keeps the lock 3 s), session A confirms H1 meanwhile — A gets
HOLD_EXPIRED, 1 active hold, 0 confirmed; stryker.
The lessons of tasks 1 and 2 were applied before the first review: `STAFF`, text-only form fields, thrown
unexpected errors, the forbidden message shown on `/` (a therapist cannot open `/holds`), a page test, an action test.
App findings, all real: the "Expired" page fixture had `held_until: null` while the real `hold_list` returns it
for every unconfirmed hold, so nothing pinned the `status === "Held"` guard (Medium; mutation now red);
the failed-query path of the page was untested (mutation red); every Confirm button had the same accessible
name (now client and slot time); empty header cell; no tie-break in the order.
Left open (known-debt): `hold_list` read without a limit while PM issue #8 is open (PostgREST `max_rows` = 1000
truncates silently).
Database findings (T-3, reviewer mutations in a copy of `supabase/` and `tests/db/`): the column grant was never
tested (widening it to table-wide stayed green — a scheduler could PATCH `slot_id`, `created_at`, `confirmed_by`:
Medium; now a test per column); a second confirm overwriting who and when, and the audit values, were untested
(Medium; 3 tests); the `holds_one_session_per_slot` index was untested (needs a way past the triggers:
`TestDb.asOwner` + `session_replication_role = replica`); the anon test passed for another reason (`permission
denied for schema private`), so the explicit `revoke` was unpinned (grants asserted with
`has_function_privilege`, for `confirm_hold`, `hold_slot`, `day_slots`); the race test built a state that
cannot occur (`created_at` moved forward). Design change: the AC-HOLD-13 check now comes before the
"another active hold" check, which made the latter dead code (an expired hold on a slot held again got "no
longer available", against AC-HOLD-13): removed; the expiry check after the lock covers the race and the unique
index is the last safeguard. My seven hand mutations of the new rules (grant widened, no confirmed guard, no
`confirmed_by`, client `confirmed_at` kept, no unique index, no revoke, no expiry check) each turn a test red.
Tooling note: a reviewer and I both wrote `scratchpad/mut.py`; my first run of the mutations executed the
reviewer's script and "passed" — an all-green run of 7 mutations is the signal to check the tool, not the tests.

Stryker T-3 (`--since main`: `holds/actions.ts`, `messages.ts`): 24 of 24 killed.
Deploy readiness T-3 (REQUIRED: migration, types): 1. `db-deploy` after merge only; deployed `main` reads `hold_list` and
inserts holds, never updates them: the new grant and policy do not touch that path. 2. New code before `db-deploy` ends:
`confirm_hold` is missing for that minute — the Confirm button shows the error page; old code on the new schema: unaffected.
3. Migration order OK. 4. Existing rows: a trigger, a policy, a column grant and a partial unique index on
`confirmed_at is not null` — no confirmed rows can exist yet (nothing could write the column), so the index builds.
5. Explicit `grant update (confirmed_at)` to `authenticated`, `revoke … from public, anon` on `confirm_hold`
(asserted with `has_function_privilege`). 6. `database.types.ts` regenerated with `supabase gen types --local`.
7. No env or dependency change. 8. `npm run build` shows `ƒ /holds` and `ƒ Proxy (Middleware)`. 9. `demo-users.json`
unchanged. 10. Red `db-deploy`; `/holds` error boundary. 11. Revert the code by PR; the schema goes forward: a
migration dropping the policy, the trigger, the index and the function (confirmed sessions would stay as rows).

## 2026-10-21 · T-4 therapist schedule (task 4 of impl-slot-hold)

Ran: gate; `run.sh`; one blind reviewer (app and tests; no migration in this task); Stryker `--since origin/main`;
hand mutations of the visibility policies. No new SQL: AC-HOLD-09 and AC-HOLD-21 are already enforced by the policies
of task 2, so this task proves them with the queries the page makes, as the therapist.
`run.sh` found a real clone (the nullable-column mapping of `slot_board` rows, in `/slots` and `/schedule`): extracted
`withSlotTimes` into `src/lib/slots.ts` with its own test. Two RLS tests moved from `holds-db.test.ts` into
`schedule-db.test.ts` and strengthened (listed by `run.sh` as removed tests; the new file pins the same rules through
`hold_list`, `day_slots`, `slots`, `therapists`, `clients`).
Hand mutations of the policies (each red): `holds_select` without the own-slot check, without the Expired check;
`slots_select` open (first survived: `day_slots` joins `therapists`, which hid the leak — a direct `select from slots`
assertion was added); the reviewer added `therapists_select` open, `clients_select_therapist = true`, 24 h → 25 h.
Reviewer findings (all Low, no High or Medium): two of three failure paths and the role gate of the page were untested
(mutations survived: now tested); page tests carried AC ids while only rendering mock data (renamed, the DB tests keep
the ids); `h.status === "Held" &&` and the second `.order("hold_id")` were redundant (removed); the "no therapist"
message had no `role`, an empty `<ul>` was rendered, a dead `data-testid` on `/` (fixed); DB tests depended on test order
(fixed). Stryker also showed that the home redirect for a therapist was untested: `src/app/page.test.tsx` added.
Left open: the slots section defaults to today, so the literal AC-HOLD-21 walk-through (open on 11-03, slot on 11-05)
shows the free slot only after picking the day (known-debt; PM period question #9 is open).
Dropped: unbounded hold list (declared; PM #9); slot-row markup repeated with `/slots` (about six lines, different content).
Stryker T-4 (53 mutants, first run, before the added tests): 31 killed; survivors were the unasserted string
literals of queries, the two error throws, the redirect and the Held/rows guards — the tests added after it cover them.

## 2026-10-21 · T-5 client overlap, re-confirm, email (task 5 of impl-slot-hold-answers)

Ran: gate; `run.sh`; one blind reviewer (database and tests); hand mutations of the migration; two races on real
Postgres 17 (Docker, `supabase start` in a scratch project, the migrations applied by the CLI); no Stryker (the only
TypeScript change is string constants in `messages.ts`).
Hand mutations (each red): overlap check removed (4 tests), touching counted as overlap, expired holds counted,
`HOLD_ALREADY_CONFIRMED` back to `SLOT_UNAVAILABLE`; the reviewer added: confirmed sessions ignored, any client,
`ends_at > v_starts_at` removed, `s.starts_at < v_ends_at` removed (survived: every case had the existing hold on the
earlier slot — a reverse-order test was added and now kills it).
Races on Postgres 17 (final migration): (1) two schedulers hold different overlapping slots (therapist1 and therapist2,
same hour) for client1, the first keeps its transaction 3 s — the second gets CLIENT_OVERLAP, 1 hold; the same run
without `for no key update` on the client row: 2 holds (the mutation); (2) two simultaneous confirms of one hold — the
second gets HOLD_ALREADY_CONFIRMED, 1 confirmed hold, `confirmed_by` is the first scheduler. The reviewer's F1 (the
client lock and the simultaneous confirm had no test, task 5.2 was ticked): PGlite has one connection, so the proof is
this hand check; task 5.2 now says so.
Reviewer findings: F1 Medium (above), F2 Low (reverse order; fixed), F3 Low (design.md named `for update`, the code and
the migration comment use `for no key update` so FK checks of other inserts are not blocked; design fixed), F4 Low (the
AC-HOLD-35 test opened a second PGlite database; now deletes the earlier client3 in the shared one). Dropped: a stale
`v_now` by the client-lock wait (milliseconds, same pattern as before); no revoke after `create or replace` (ACL kept,
checked with `pg_proc`).
Deploy readiness T-5 (REQUIRED: migration): 1. `db-deploy` after merge only; deployed `main` holds slots through
`hold_slot` and confirms through `confirm_hold`: the new trigger bodies only add a check and a code. 2. New code before
`db-deploy` ends: the overlap and "already confirmed" messages are missing for that minute — an old code shows the
generic error page (the codes are unknown to it); old code on the new schema: unaffected. 3. Migration order OK
(`20261021120000` after `20261019143503`). 4. Existing rows: no table or constraint changes; the trigger checks only
new inserts. 5. `create or replace` keeps the ACL: `guard_new_hold` and `guard_confirm` are `security definer`,
`search_path = ''`, executable by nobody but the owner (checked with `pg_proc.proacl`). 6. `database.types.ts`:
`supabase gen types --local` on the scratch database equals the committed file. 7. No env or dependency change.
8. `npm run build` unchanged routes. 9. `demo-users.json` unchanged. 10. A red `db-deploy`; a hold or confirm showing
the error page. 11. Revert the code by PR; the schema goes forward: a migration restoring the old trigger bodies.

## 2026-10-21 · T-6 «Past» and expired holds until the slot starts (task 6 of impl-slot-hold-answers)

Ran: gate; `run.sh`; one blind reviewer (views, page, tests); hand mutations of the migration; no Stryker (the page change
only removes a label). Hand mutations (each red): no `Past`; `Past` checked before an active hold; the `hold_list` filter
removed; widened to hide every started hold; widened to hide every expired hold; `holdable` ignoring the start.
Reviewer evidence: a PGlite probe shows both views keep the same columns, order, types, `security_invoker`, owner and
grants after `create or replace`. Findings: T1 Medium — the "(включно)" boundary test set `starts_at = now()` in one
transaction and read the view in the next, where `now()` is larger, so it only proved "started in the past" (inlining
`< now()` in the views stayed green): the boundary is now pinned where it lives, `private.slot_started(now(), now())`,
and the test title no longer overclaims; T2 Low — the page test line "no «Started»" passed against the old page too
(the label became dead code once the view stopped returning `Free` with `holdable = false`): removed; D1 Low — the Q1–Q4
rows of `docs/spec-reading.md` still said "очікуємо" after the PM answers: updated; N1 Low — a second `boardOf` in a test
file shadowed the fixture of the same name: renamed. Flake found while stacking task 7: two slots of one therapist moved
to the same `now() - 10 minutes` in separate calls hit `slots_therapist_start_key` (PGlite can return the same `now()`):
start offsets are distinct now. Dropped: hiding in the view while the table stays readable (design Р10, the view is the
list), non-sargable per-row calls in the `hold_list` filter (small list; known-debt row on the unbounded `/holds` read).
Deploy readiness T-6 (REQUIRED: migration): 1. `db-deploy` after merge only; the deployed code reads `slot_board` and
`hold_list`: the same columns, only the `status` text of a started free slot changes to `Past` and the old `/slots` page
(the label "Started") still works. 2. New code before `db-deploy` ends: the page shows "Free" for a started slot for that
minute and does not show "Past" — cosmetic. 3. Migration order OK (`20261021130000` after `20261021120000`).
4. Existing rows: views only, no data change. 5. `create or replace view` keeps the grants and `security_invoker`
(probe: `reloptions`, `relacl` equal). 6. `database.types.ts` equals `supabase gen types --local` on a scratch database
with the migration applied. 7. No env or dependency change. 8. Build unchanged. 9. `demo-users.json` unchanged.
10. A red `db-deploy`; `/slots` or `/holds` error page. 11. Revert the code by PR; the schema goes forward: a migration
restoring the two view bodies.
