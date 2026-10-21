# Known debt and decisions (quality trial)

Reviewers read this before reporting. Each line is already raised or decided, so a finding that only
restates it is not reported; a finding that shows the change makes it **worse** (a new copy, a new
caller, a new dependant) is. It holds decisions, not the intent of any step, so blindness stands.
Add a line when a finding becomes its own refactor or a decision; remove it when it lands.

| Item | Status (source) |
|---|---|
| Concurrency of "one active hold per slot" is tested only sequentially on PGlite (one connection); the guarantee is the row lock in the trigger | decision: a two-connection test needs real Postgres in CI (`.github` change, ask first) — slice 1 database review |
| `src/lib/supabase/database.types.ts` is hand-written until a `db-check` summary is copied in | replace with the generated file in the PR that adds the schema |
| Therapist ↔ user link by `profiles.email = therapists.email` | decision for slice 1 (therapists are seed data); depends on sign-up staying disabled in the cloud project |
| Foreign keys `created_by`, `confirmed_by`, `client_id` without a deliberate `on delete` | open — slice 1 database review, Low |
