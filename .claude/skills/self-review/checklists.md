# Area checklists

Give each area's reviewer its section, plus the project's additions for that area. Each item names a
defect class that a single unguided review has missed in practice.

## CI & workflows

- A job that changes shared state (migrations, deploys, publishing) `needs:` every job that
  validates what it ships - including validation jobs added in this change.
- Top-level `permissions:` at least privilege; wider only on the job that needs it.
- `timeout-minutes` on every job. `cancel-in-progress` never on the default branch: it can cancel a
  migration or deploy halfway.
- No `${{ github.event.* }}` inside `run:`; secrets only through `env:`; third-party actions pinned
  to a commit SHA.
- A health gate checks that the *new* version is the one answering, not just a 200; cleanup
  (image prune) runs only after health passes; there is a way back.
- `|| true` or `continue-on-error` hiding a real failure.

## Containers

- `HEALTHCHECK` has `--start-period` / `--start-interval`: proxies may not route to a `starting`
  container, so a long first interval is downtime on every deploy.
- Env that changes on every deploy (a git SHA) recreates the container on every deploy.
- Non-root user, multi-stage build, pinned base image, no secret in any layer.
- `.dockerignore` excludes every secret-bearing file `.gitignore` excludes - `COPY . .` puts them
  in the build cache even when they never reach the final image.

## Database & migrations

- **Triggers:** triggers on the same table and event fire in name order. Can one statement fire
  two of them, so the second sees the first one's writes? An AFTER trigger sees the new row - a
  "before" snapshot built there contains post-update data.
- **Locks:** DDL on a hot table (create/drop trigger, alter table) holds ACCESS EXCLUSIVE until
  commit. Set `lock_timeout`, and keep backfills short or out of that transaction.
- **Privileges:** functions are EXECUTE-to-PUBLIC by default, and a role with schema USAGE can call
  every function not revoked from it. Use `alter default privileges ... revoke execute`, and revoke
  from every grantee the platform grants by default.
- `SECURITY DEFINER` with a fixed `search_path`; declared volatility is honest (reading the clock
  or statistics views → `VOLATILE`).
- **Row-level security:** scope each table by its own ownership column, not through a join to
  another table whose ownership can change.
- Every foreign key has a deliberate `ON DELETE`.
- Re-run safety, and what happens to rows that already exist.
- **Invariant tests:** can each assertion fail? Equal counts hide a +1/−1 pair; a bound that holds
  by construction proves nothing.

## Auth & access

- Fails closed: a missing, conflicting (public *and* scoped on the same target) or unknown access
  declaration denies, and a startup check rejects it.
- Missing, malformed, unknown, revoked and expired credentials get the same response; secrets are
  compared in constant time or inside the database.
- Rate limits are keyed on what the docs promise - check the library's default key (it may add
  the route).
- TLS for anything non-local verifies the certificate; `require` often means "encrypt, do not
  verify".
- Audit and logs: aborted requests record a real outcome; secrets redacted; client-supplied
  headers (forwarded-for, request ids) bounded and not trusted.
- Routes registered outside the normal controller path (docs, health, static) bypass guards,
  throttles and audit.

## Data access & API contract

- Input validation accepts nothing the database rejects (dates, offsets, ranges) - otherwise a
  client error becomes a 500.
- Opaque tokens (cursors) are validated for meaning, not only for shape.
- Pagination: a total order with a tie-breaker, `limit + 1` for has-more, no skipped or repeated
  rows.
- The documented contract (DTO descriptions, OpenAPI, README) says what the code does, deliberate
  deviations included.
- One bad row fails one item, not the whole page or feed forever.
- Transient database and network errors map to a retryable status; unmapped framework errors keep
  their status; no internals in response bodies.

## UI

- Loading, empty and error states; every role that sees the screen.
- Verified in a real browser, not inferred from the code.

## Tests

- Would the test fail if the behaviour it names were broken? Watch for `> 0` when earlier tests
  already produced rows, sleeps instead of polling, and fakes that silently tolerate bad input.
- Conditional skips (missing env) turn green with nothing run - fail loudly when required env is
  missing.
- Is it run in CI? If not, where, and who notices a failure?
- Cleanup in `finally` / `afterEach`; nothing waits forever on a promise that never resolves when
  setup fails.

## Scripts & data fixes

- Writes go through the same contract as the application (archival metadata, `updated_at`, RPCs),
  not raw updates that skip side columns.
- Comments state the real reason; a stale rationale is a defect.
