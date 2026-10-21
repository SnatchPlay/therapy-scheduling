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
| App UI texts in English (PM's acceptance texts are English), while `/login` and `<html lang>` are Ukrainian | open, Low — one language for the whole UI |
| `/clients` form keeps no values after an error; the success message uses the alert style | open, Low |
| `/slots` loads every client and repeats them as options in each holdable slot's form | open, Low — one picker or a searched list when the client count grows |
| Hold and Create buttons have no pending state: a double click sends two actions, the second reports "no longer available" | open, Low |
| `/holds` reads `hold_list` without a limit: PM answered #8 (expired holds leave the list when the slot starts, AC-HOLD-29), but confirmed sessions and held rows stay, and PostgREST `max_rows` (1000) would cut the list silently | open, Low — paging or a time window once the list grows |
