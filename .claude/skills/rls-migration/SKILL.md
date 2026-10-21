---
name: rls-migration
description: "Use for any Supabase schema or security change in this repo: a new table/column/view, a new or changed RLS policy, a grant, a function (public RPC or private helper), a trigger, or any file in supabase/migrations/. Enforces explicit grants, revoke from every default grantee, set-based policy predicates, a PGlite test per rule that fails when the rule is removed, and the db-deploy-only path to the cloud. Not for reading data or for UI-only changes."
user-invocable: true
---

# Schema & RLS migration

The publishable key is in the browser bundle, so anyone can call the Data API (PostgREST) directly,
skipping every page and Server Action. **RLS, grants and functions are the security boundary;**
the proxy, layouts and hidden buttons are UX. A wrong policy or a stray grant is the whole failure,
not one of several layers.

## Hard rules

1. **Start every new object from nothing.** Supabase grants new `public` objects to `anon`,
   `authenticated` and `service_role` by default (until 2026-10-30 for existing projects). Write:

   ```sql
   revoke all on table public.thing from anon, authenticated;
   grant select on table public.thing to authenticated;             -- only the verbs the app uses
   grant insert (col_a, col_b) on table public.thing to authenticated; -- column grants for writes
   ```

   A table-wide `grant update` makes every column writable over the Data API, including `role`,
   `status`, owner and timestamps. Writable columns are listed one by one.

2. **Functions are EXECUTE to PUBLIC and to `anon` by default.** `revoke … from public` does not
   remove the `anon` grant: they are different grantees.

   ```sql
   revoke execute on function public.f(uuid) from public, anon;
   grant execute on function public.f(uuid) to authenticated;
   ```

3. **`security definer` only in schema `private`, always with `set search_path = ''`.** Public RPCs
   are `security invoker` thin wrappers; role checks inside them give the user a precise message,
   RLS and triggers are the last gate. Role comes from `public.profiles.role` via
   `private.current_app_role()` (migration `20261012000000_profiles_and_roles.sql`), never from
  `user_metadata` or the JWT.

4. **One policy per operation, `to authenticated`, `(select auth.uid())`.** Never `for all`, never
   `using (true)` on private data.

5. **Set-based predicates on tables that grow.** A helper called per row is O(rows):

   ```sql
   -- slow on big tables: one call per row
   using (private.slot_is_mine(slot_id))
   -- set-based: the subquery runs once
   using (slot_id in (select s.id from public.slots s where s.therapist_id = (select private.current_therapist_id())))
   ```

   Small reference tables may use the per-row form; say so in the migration comment.

6. **Check-then-write in one transaction, behind a row lock.** supabase-js has no transactions:
   a rule like "one active hold per slot" lives in a trigger or function that takes
   `select … for update` on the parent row, then checks, then writes. Time checks after the lock
   use `clock_timestamp()` when the transaction may have waited.

7. **Applied migrations are immutable.** Fix forward with a new file
   (`npx supabase migration new <name>`). The cloud database changes only through a merged PR and
   the `db-deploy` job; never `supabase db push`, SQL Editor, Table Editor or `migration repair`.

## Proving it

Every rule above gets a test in `tests/db/*.test.ts` on PGlite (`@electric-sql/pglite`; the helper
`tests/db/supabase-pglite.ts` applies every migration and runs SQL as the real role — `asUser`,
`asAnon`, `asService`; it arrives with the first slice that adds tables):

- the allowed path works **and** the forbidden path is refused **and** the data did not change;
- a direct Data API write (`insert` / `update` as the user) is refused, not only the RPC;
- `anon` reads nothing from each new table, view and function;
- **mutation check:** remove the policy, grant or `if` and confirm the test goes red; record
  "AC → what was removed → which test failed" in the PR. A test that stays green without the rule
  covers nothing.

Read the grants back instead of trusting the migration text:

```sql
select grantee, privilege_type from information_schema.role_table_grants where table_name = 'thing';
select proname, proacl from pg_proc where proname = 'f';
```

## Checklist

- [ ] `revoke all … from anon, authenticated` and explicit grants (column grants for updates)
- [ ] functions: `revoke execute … from public, anon`; definer only in `private` with `search_path = ''`
- [ ] one policy per operation; set-based predicate on growing tables
- [ ] check-then-write inside one trigger/function with a row lock
- [ ] PGlite tests: allowed, refused, data unchanged, direct Data API write refused, `anon` refused
- [ ] mutation check recorded in the PR
- [ ] `node scripts/check-migration-order.mjs`; `db-check` green; after merge `db-deploy` green
- [ ] `src/lib/supabase/database.types.ts` from the `db-check` summary
- [ ] `.quality-trial/deploy-readiness.md` answered (a migration always triggers it)
