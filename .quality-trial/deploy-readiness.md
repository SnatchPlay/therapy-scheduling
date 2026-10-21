# Deploy readiness (quality trial)

The author answers this, with evidence, when `run.sh` prints "REQUIRED" (a migration, the seed,
`supabase/config.toml`, a workflow, Next/Vercel config, env names, a package manifest, the proxy or
the Supabase clients). A diff reviewer cannot answer it: it needs runtime, data and platform facts.
Each answer is a command with its real output, or `N/A — <reason>`. "Should be fine" is not an
answer. Log the answers in `findings-log.md`, one line each.

## Database

1. **Who applies it, and when.** Only `db-deploy` after the merge to `main`, through environment
   `production`. Preview deployments and production share **one** database: from the moment
   `db-deploy` finishes, every open preview and the production build run against the new schema.
   State what the currently deployed code does against it.
2. **Old code against the new schema, new code against the old.** Expand, then contract: add before
   use, drop after the last reader is gone. Vercel can deploy the code before `db-deploy` finishes:
   what does the new code do for that minute?
3. **Order against main.** `node scripts/check-migration-order.mjs` and the `db-check` job: the new
   file is newer than the newest migration on `main`; no applied file changed.
4. **Existing rows.** What happens to rows that already exist (users from `users:demo`, the seed
   data of earlier migrations)? A new `check` or role set: are the existing values valid?
5. **Grants and the 2026-10-30 change.** Explicit grants for every new table, view and function; the
   app does not rely on Supabase's default grants.
6. **Generated types.** `src/lib/supabase/database.types.ts` matches the schema of this PR (the
   `db-check` summary).

## Runtime

7. **Env.** Every new or renamed variable: set in Vercel Production *and* Preview (or deliberately
   only one, with the reason); what the code does when it is unset. `SUPABASE_SECRET_KEY` never in
   Vercel unless an ADR says the slice calls the Admin API.
8. **Build.** `npm run build` shows `ƒ Proxy (Middleware)`; the preview of this PR opens without a
   Vercel login.
9. **Synthetic users.** Does `supabase/demo-users.json` need new entries or roles? After merge:
   `npm run users:demo`.

## After it ships

10. **How we would know it failed.** The red job, the failing page, or the test that fires.
11. **The way back.** Revert the code (a new PR); the schema goes forward only — the reverting
    migration, and what is lost.
