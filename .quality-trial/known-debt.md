# Known debt and decisions (quality trial)

Reviewers read this before reporting. Each line is already raised or decided, so a finding that only
restates it is not reported; a finding that shows the change makes it **worse** (a new copy, a new
caller, a new dependant) is. It holds decisions, not the intent of any step, so blindness stands.
Add a line when a finding becomes its own refactor or a decision; remove it when it lands.

| Item | Status (source) |
|---|---|
| Concurrency of "one active hold per slot" is tested only sequentially on PGlite (one connection); the guarantee is the row lock in the trigger | decision: a two-connection test needs real Postgres in CI (`.github` change, ask first). Checked by hand on Postgres 17 in Docker 2026-10-21: with the lock the second session waits and gets SLOT_UNAVAILABLE (1 hold); without `for update` — 2 holds |
| Therapist ↔ user link by `profiles.email = therapists.email` | decision for slice 1 (therapists are seed data); depends on sign-up staying disabled in the cloud project |
| Foreign keys `created_by`, `confirmed_by`, `client_id` without a deliberate `on delete` | open — slice 1 database review, Low |
| Demo accounts `member1@`, `member2@example.test` in the cloud project became `scheduler` (design Р1) and are no longer in `demo-users.json` | open — removing them is a write to the cloud project: the owner does it in the dashboard |
| `/slots` loads every client and repeats them as options in each holdable slot's form | open, Low — one picker or a searched list when the client count grows |
| Hold and Create buttons have no pending state: a double click sends two actions, the second reports "no longer available" | open, Low |
| `/holds` reads `hold_list` without a limit: the list now holds only "Held" and "Expired" holds of slots that have not started (AC-HOLD-38, 42), and PostgREST `max_rows` (1000) would still cut it silently | open, Low — paging or a time window once the list grows |
| `scripts/check-design-tokens.mjs` and `scripts/check-server-boundary.mjs` are vendored from the course materials and kept as they are (CodeRabbit on PR 30): colour properties other than `color`/`background(Color)`/`borderColor` in inline styles, a directory that cannot be read ending in OK, a bare `--root`, `import()`/`require()` of the admin client are not caught | open, Low — report upstream to the course; a local patch would drift from the source |
| `normalize_client` runs before the insert policy: a therapist posting a card with a future date of birth gets the date message, not "Only schedulers and admins…" (no data leaks) | open, Low |
| `private.is_valid_email` accepts `a@.` and `a@.com` (PM rule: "a dot in the part after @", AC-HOLD-39) | decision: stay literal to PM's rule; revisit if PM answers #21 with a stricter format |
| The practice time zone literal `America/Los_Angeles` is in several SQL files and `PRACTICE_TIME_ZONE` in TypeScript | open, Low — PM fixed the zone; applied migrations cannot be edited |
| Slice 2 database: when several `clients` check constraints fail at once, Postgres reports one, so the message depends on constraint order (a child with an empty name and no guardian gets the guardian message) | open, Low — the card form shows one message above the form (DESIGN.md §5); per-field texts come when PM answers Sofiia-pm/therapy-scheduling-spec#21 |
| `/clients` loads every client card without a limit (like `/holds`): PostgREST `max_rows` (1000) would cut the list silently | open, Low — paging or search (PM: out of scope for slice 2) |
| `/?msg=HOLD_FORBIDDEN` and `/?msg=CONFIRM_FORBIDDEN` from the hold and confirm actions are never shown: `/` sends a therapist to `/schedule`, a user without a role sees only the no-access message | open, Low — present before slice 2 |
| `PUBLIC_PATHS` in `src/lib/supabase/proxy.ts` is compared with `startsWith`, so a future `/login-x` route would be public | open, Low — every page still calls `requireRole` |
| `INVALID_BIRTH_DATE` text ("not in the future") is also shown for a malformed or impossible date; the field label carries the format | open — PM text pending, Sofiia-pm/therapy-scheduling-spec#21 |
