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
rows of `docs/spec-reading.md` still said "очікуємо" after the PM answers: the update goes in its own «Специфікація» PR
(`docs/spec-reading.md` is not a «Реалізація» file — CodeRabbit on this PR); N1 Low — a second `boardOf` in a test
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

## 2026-10-21 · T-7 weekly schedule (task 7 of impl-slot-hold-answers)

Ran: gate; `run.sh`; one blind reviewer (app, database function, tests); hand mutations; Stryker `--since origin/main`
(`time.ts`, `schedule/page.tsx`).
Reviewer findings (nothing above Medium): F1 Medium — the DB tests resolved the therapist id with a sub-select run as
the caller, so RLS gave `NULL` and "therapist1 asks for therapist2" returned `[]` for any implementation: making
`slots_between` `security definer` left all tests green while a probe showed the leak; the id is now fetched once with
`service_role` and passed as a parameter (the same mutation is now red); F2 — the DST weeks were not pinned
(`quietDay` drifts through seasons, the "DST" assertion in `time.test.ts` was plain date arithmetic): fixed weeks
2026-10-26 and 2027-03-08 with slots at Monday 00:00, Sunday 23:00 and the next Monday 00:00 (replacing the zone by a
fixed `'PST'` offset is now red); F3 — grouping by `practiceDate` and the default week were not distinguished from UTC
(fixtures at 10:00 PT): a Monday 23:00 PT slot (Tuesday in UTC) and a fake clock on Sunday 21:00 PT added (both
mutations red); F4 — `?week=9999-12-27` passed `isIsoDate` and `addDays` produced `+010000-01…`, an error page for a
typed URL: year 9999 is rejected like year 0000; F5 — the anonymous test passed without the `revoke` (anon has no
privilege on the view anyway): it now expects `permission denied for function slots_between`; F6 — the obsolete
known-debt row about the day default, the unused `data-testid`, titles that had lost their AC IDs, the conformance rows
without `slots_between`: fixed. Dropped: DST and the half-open range in SQL (probed for both weeks), grants of
`day_slots` after `create or replace` (`proacl` equal), the silent fall back to the current week for an invalid `?week=`
(same as `/slots?day=`).
Stryker T-7 (52 mutants): 41 killed; survivors: the query-string literals the fake client ignores, the `isIsoDate` regex
guards that the round trip check repeats (equivalent), and two page assertions (the "No slots this week." condition
and the day heading link) — covered by a test added after the run.
Deploy readiness T-7 (REQUIRED: migration, types): 1. `db-deploy` after merge only; deployed `main` reads `day_slots` —
unchanged signature and result, now implemented through `slots_between`. 2. New code before `db-deploy` ends:
`/schedule` calls `slots_between`, which does not exist for that minute — the error page for therapists; the old code on
the new schema: unaffected. 3. Migration order OK (`20261021140000` after `20261021130000`). 4. Existing rows: a new
function and a redefined one, no data change. 5. Explicit `revoke … from public, anon` and `grant … to authenticated` for
`slots_between` (tested); `create or replace` of `day_slots` keeps its ACL (`proacl` checked). 6. `database.types.ts`
equals `supabase gen types --local` on a scratch database with the migration applied. 7. No env or dependency change.
8. `npm run build` shows `ƒ /schedule`. 9. `demo-users.json` unchanged. 10. A red `db-deploy`; `/schedule` error page.
11. Revert the code by PR; the schema goes forward: a migration dropping `slots_between` and restoring `day_slots`.

## 2026-10-25 · login page texts (small change after the course feedback)

Course feedback: the login page kept the template's Ukrainian title and heading while the whole interface is English
(PM's acceptance texts are English). `/login` strings, `<title>`, `<html lang>` are English now; the known-debt row is
closed; a page test pins the texts (none existed). Gate: lint, typecheck, 195 tests, build. Not run: Stryker (strings
only), a blind review (a text change in one component), visual check in a browser (the page needs the Supabase env
for the proxy; the build and the server-render test pass).
Found on the way: `npm run build` now prints a Next.js security advisory (critical, range 16.0.0–16.4.0, fixed in
16.4.3: unauthenticated RCE through the image optimizer with SVG and through `use cache` typed arrays; DoS in Server
Actions) — published after the pin in `package.json`. Not part of this change: a dependency bump goes in its own PR.

## 2026-10-25 · Next.js 16.4.0 → 16.4.3 (security)

Why: `npm run build` printed a Next.js security advisory after the pin; `npm audit --omit=dev` listed a critical one for
`next` 16.0.0–16.4.0 (unauthenticated RCE through the image optimizer with SVG and through `use cache` typed arrays; DoS in
Server Actions), fixed in 16.4.1. Release notes 16.4.2 and 16.4.3 are backports (Turbopack fixes, "don't load the app-page
runtime in proxy.ts", Google font URLs, OpenTelemetry); `eslint-config-next` moved with it (same version).
Ran: lint 0, typecheck, 195 tests, build (`▲ Next.js 16.4.3`, no advisory line, same routes and `ƒ Proxy (Middleware)`),
`spec:validate`, `ac:coverage`, `run.sh` (no new findings); `npm audit --omit=dev`: 0 vulnerabilities (was 1 critical).
Left: `npm audit` (dev tree) still lists `zod` < 4.6.6 (high, memory exhaustion on oversized collections) through
`@fission-ai/openspec` and `eslint-plugin-react-hooks`: dev tools only, nothing of it reaches the deployed bundle.
No blind review (a pinned-version change, no source change); no Stryker.
Deploy readiness (REQUIRED: package manifest): 1–6. N/A — no migration, no table, no grants, no generated types.
7. No new or renamed variable. 8. `npm run build` shows `ƒ Proxy (Middleware)`; the preview of this PR is opened
without a Vercel login (checked below in the PR). 9. `demo-users.json` unchanged. 10. How we would know it failed: a red
`app` job or a red Vercel build; on prod `/login` not answering 200 or `/slots` not redirecting to `/login` (the proxy).
11. The way back: revert the PR (the lockfile returns to 16.4.0); the schema is untouched.

## 2026-10-25 · Design system (WS7, task B)

Ran: gate (lint 0, typecheck, 205 tests, build, `check:design` OK from 36 violations in 8 files, `check:boundary` OK,
`ac:coverage`), `run.sh`, one blind reviewer (UI, design system, CI), a local render of `/login` in both themes and the error
state. No Stryker (styling and markup). Visual check of the slice pages: on the PR preview (needs a sign-in; see the PR).
`run.sh`/fallow: unused `card.tsx`, `utils.ts` and exports (AlertAction, AlertDescription, TableFooter, NativeSelectOptGroup,
`badgeVariants`) removed; the two clones are between the course's check scripts (not ours); the styling findings are Tailwind
class noise.
Reviewer findings, all verified: (1) Medium — `shadcn` (+278 packages in production dependencies, a high `zod` advisory in
`npm audit --omit=dev`) and `tw-animate-css` were there only for two CSS imports that emit nothing for our components: both
removed, `npm audit --omit=dev` is 0 again, the other new packages pinned exactly; (2) Medium — DESIGN.md claimed behaviour the
code does not have (field-level errors, "input stays in the form", a Loading state, `EmptyState` for "No free slots", gaps,
one primary button per screen): the document now says what the code does and marks what comes with slice 2; (3) `color-scheme:
light dark` added (native controls and `NativeSelectOption` colours in the dark theme); (4) `Alert` takes its role from the
variant, notices after a redirect stay `role="alert"` (a live region present at load is not announced), with a test;
(5) the `architecture` jobs are not required checks in `solo-main`: the ADR says so; (6) `StatusBadge` used `in` (prototype
keys) and rendered an empty badge for `null`: `Object.hasOwn`, "Unknown", a test; (7) dead upstream classes and needless
`"use client"` on Table and Label removed; (8) dropped: `SUCCESS_CODES` next to `MESSAGES` (three codes, the default is the
safe red error). Process note: AGENTS.md/DESIGN.md/scripts/`.github` are outside the «Реалізація» list — the PR says so.
Deploy readiness (REQUIRED: package manifest, config): 1–6. N/A — no migration, no types. 7. No new env variable.
8. `npm run build` shows `ƒ Proxy (Middleware)`; the preview of this PR opens without a Vercel login (checked in the PR).
9. `demo-users.json` unchanged. 10. How we would know it failed: a red `app` (lint, tests, build), a red `architecture`
job, a broken style on the Vercel preview. 11. The way back: revert the PR (the lockfile returns); the schema is untouched.

## 2026-10-25 · Storybook (component catalogue, after the design system)

Ran: gate (lint 0, typecheck, 205 tests, `next build`, `check:design`, `check:boundary`, `npm audit --omit=dev`: 0),
`run.sh` (no new findings), `npm run build-storybook`, a local render of the built catalogue and axe (WCAG A/AA, `axe-core`
from the a11y add-on) over every story in both colour schemes: 38 story × theme runs, no violations. No blind review (a
dev-tool change that does not reach the app bundle); no Stryker.
Found while building, all fixed before the first commit: (1) the stories rendered unstyled — Storybook's Vite builder
does not run Tailwind 4 (the app uses `@tailwindcss/turbopack`): `@tailwindcss/vite` added through `viteFinal`; (2) text in
a serif font — `--font-sans: var(--font-geist-sans), …` is invalid when `next/font` is not there: fallback variables in
`.storybook/preview-head.html`; (3) after the build `npm run lint` reported 12 722 problems — it linted the built
`storybook-static`: ignored in `eslint.config.mjs` and in `.gitignore`.
Known gaps (ADR 0003): no theme switch in the catalogue (dark follows the system), no automated story tests
(`addon-vitest`), no hosted visual regression.
Deploy readiness (REQUIRED: package manifest, workflow): 1–6. N/A — no migration, no types. 7. No new environment
variable. 8. `npm run build` shows `ƒ Proxy (Middleware)`; the preview of this PR must open without a Vercel login
(checked in the PR). 9. `demo-users.json` unchanged. 10. How we would know it failed: a red `app` job (lint, typecheck,
tests, build) or a red «Storybook: збірка» job (not a required check). 11. The way back: revert the PR (the lockfile
returns); the new packages are devDependencies, the app bundle does not change.

## Task 8 — client card and access in the database (WS7, slice 2)

Reviews (blind, by area): correctness of database and access — no access holes; findings were test gaps (a Confirmed session older than 24 h, adult without email, child without guardian email, unknown client type, guardian name trim, non-deterministic `idOf`, UTC-versus-practice-day boundary), all fixed with a test and a hand mutation that turns it red (M11–M15; M16, the time-zone mutation, survives outside the hours when the UTC date runs ahead of Los Angeles: stated in the test). Principles review — no blockers; stale conformance rows for `normalize_client_email` fixed, `not valid` on `clients_email_check` added after the "existing rows" probe (`legacy@localhost` would have failed the migration), duplicate tests removed, `DemoUser.role` typed `string | null`. fallow: `clientErrorCode` was too complex (NEW complexity) → rewritten as a rule table, audit passes.
Deploy readiness (REQUIRED: migration, demo-users.json): 1–2. Applied only by `db-deploy`; the old app inserts `(full_name, email)` and reads `id, full_name, email`, which the new schema serves (`client_type` defaults to `Adult`); the new code reads no new column yet. 3. `node scripts/check-migration-order.mjs` → "OK: нових міграцій 1, усі новіші за 20261021140000". 4. Existing rows: Adult by default, `email` present, no guardian → valid; `clients_email_check` is `not valid`, so a legacy email without a dot does not fail the deploy; `profiles_role_check` accepts all current roles. 5. No new table; new `grant insert` is per column; `private.own_client_ids`, `has_visible_text`, `is_valid_email` revoke from `public, anon`. 6. Types: `db-check` summary, after the first CI run. 7. No new variable. 8. `npm run build` shows `ƒ Proxy (Middleware)`. 9. `newuser1@example.test` (`"role": null`) added: after `db-deploy` the owner runs `npm run users:demo` (before it, the old schema refuses a null role). 10. Red `db-check`/`app`, or a failing `tests/db/client-card-db.test.ts`. 11. Revert the code; the schema goes forward only — a reverting migration would drop the five card columns (losing card data) and restore `default 'therapist'`.

## Task 9 — client card pages (WS7, slice 2)

Reviews (blind, correctness and principles): one real defect — after a failed action React 19 resets the form and the type/language selects lost their values, so a "Child" form came back as "Adult" (found by the correctness reviewer in a real browser harness; the static-markup test could not see it). Fixed by remounting the fields with a key from the action result; re-checked in the browser harness (type, language, name and guardian fields kept, the alert and `aria-invalid` on the guardian fields shown). Also fixed: the birth date accepted `06.05.1990` (saved as 5 June), `epoch`, `-infinity` — the action now requires a real `YYYY-MM-DD` date through the existing `isIsoDate`; an empty form from a therapist now gets the rights refusal (the date is sent as null so the insert reaches the RLS check); list as `<ul>`, heading and visible link on the card; `Card` trimmed to the parts in use (header, title, content); weak assertions replaced; `viewer` read error covered; `/slots` empty-client branch covered. Left as known debt: a single message above the form, `/clients` without a limit, never-shown `/?msg=…` redirects (existing), `startsWith` in `PUBLIC_PATHS` (existing).
Removed tests, each replaced: the four `createClientCard` tests of slice 1 became the AC-CARD-01…06 and AC-HOLD-11/16 tests of the new `(previous, formData)` action; the shell test now expects the Clients link for a therapist; the home test for "Profile not found." became AC-CARD-11.
Mutation (app level, hand-made): proxy without redirect (AC-CARD-07, 7 red), therapist's missing card as 404 or without the refusal (AC-CARD-05/08, 3 red each), action without the no-role redirect (AC-CARD-11), home without the notice (AC-CARD-11), `requireRole` letting a null role in (AC-CARD-11), the create button for a therapist (AC-CARD-06/04), the empty therapist list without PM's text (AC-CARD-09), the values not returned to the form (AC-CARD-03/06), the child's guardian email missing in the picker (AC-CARD-02), the optional birth date (AC-CARD-01) — every mutation turned at least one test red.
Deploy readiness (REQUIRED: `viewer.ts`, new tests): 1–6. N/A — no migration and no types change in this task. 7. No new variable. 8. `npm run build` lists `/clients`, `/clients/[id]`, `/clients/new` and `ƒ Proxy (Middleware)`; the preview of this PR must open without a Vercel login. 9. `supabase/demo-users.json` already has `newuser1@example.test` (task 8): the owner runs `npm run users:demo` after the task 8 deploy (done in the cloud: `db-deploy` green); the no-role screen needs that user. 10. A red `app` job (lint, typecheck, tests, build), the failing page tests, or the `/clients` page throwing on `error.tsx`. 11. Revert the code (a new PR); the schema from task 8 stays and is compatible with the old pages (the old form inserts `full_name` and `email`, which the schema accepts).
## Task 10 — hold list rules (WS7, slice 2)

Review (blind, correctness and principles in one): no access hole (the view stays `security_invoker`, `anon` refused), no regression of `/slots`, `/schedule`, confirmation; test gaps fixed: the `not exists` of AC-HOLD-37 was checked only for "old expired + new held" (mutations "newer only unconfirmed" and "newer only active" stayed green) → two tests (re-hold confirmed; re-hold expired too), both mutations now red (H5, H6); three helpers read the list for things it no longer shows (confirmed sessions, started slots) → they read the table instead; the "Held until" check was true by construction → now compared with the clock window; a false ordering assertion removed; `known-debt.md` line about `/holds` corrected. Removed test: AC-HOLD-29 "Held and Confirmed of a started slot stay in the list" — PM reversed it with AC-HOLD-42 and AC-HOLD-38; replaced by the AC-HOLD-42 and AC-HOLD-38 tests.
Mutations (hand-made): Confirmed in the list (AC-HOLD-38), started slot not hidden (AC-HOLD-42, plus AC-HOLD-29), old expired not hidden (AC-HOLD-37, 4 red), email in `slot_board` (AC-HOLD-40), "newer" narrowed to unconfirmed / active (AC-HOLD-37) — each turns at least one test red.
Deploy readiness (REQUIRED: migration): 1–2. Applied only by `db-deploy`; the view keeps its columns, so the old app (`/holds` reads the same columns, orders by `created_at`) still works — it just sees fewer rows. 3. `node scripts/check-migration-order.mjs` → OK, 1 new migration newer than `20261026100000`. 4. No table data touched; the view only filters. 5. `create or replace view … security_invoker = true`; grants unchanged (`select` to `authenticated`, none to `anon`: tested). 6. Types unchanged (same columns). 7. No new variable. 8. `npm run build` shows `ƒ Proxy (Middleware)`. 9. `demo-users.json` unchanged. 10. Red `db-check`/`app`, or `tests/db/hold-list-db.test.ts`. 11. Revert the code; schema forward only — a reverting migration restores the previous `where` of the view (nothing is lost).
