-- Ролі зрізу 1 і картка клієнта (impl-slot-hold, design.md Р1–Р2).
-- AC-HOLD-10, AC-HOLD-11, AC-HOLD-15, AC-HOLD-16; ролі — матриця прав requirements/product.md.

-- ── Ролі: admin, scheduler, therapist замість member, admin шаблону ─────────
-- Порядок із заголовка 20261012000000_profiles_and_roles.sql: старий constraint → дані → default → новий constraint.
alter table public.profiles drop constraint profiles_role_check;
-- Старі демо-акаунти member — найменші права (therapist без рядка в therapists нічого не бачить); ролі ставить users:demo.
update public.profiles set role = 'therapist' where role = 'member';
-- Найменші права за замовчуванням: терапевт без рядка в therapists не бачить нічого.
alter table public.profiles alter column role set default 'therapist';
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'scheduler', 'therapist'));

-- Хелпер для політик: планувальник або адміністратор (AC-HOLD-19: admin може все, що й scheduler).
create or replace function private.is_scheduler_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.current_app_role()) in ('scheduler', 'admin'), false);
$$;

revoke execute on function private.is_scheduler_or_admin() from public, anon;
grant execute on function private.is_scheduler_or_admin() to authenticated;

-- ── Таблиця clients ─────────────────────────────────────────────────────────
create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  email      text not null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  -- AC-HOLD-11: порожнє ім'я (зокрема лише з пробілів) не приймаємо.
  constraint clients_full_name_check check (btrim(full_name) <> ''),
  -- AC-HOLD-15: email — один знак @ з текстом до й після, без пробілів.
  constraint clients_email_check check (email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  -- AC-HOLD-16: email унікальний (точне порівняння, як у вимозі PM; регістр — питання Q2).
  constraint clients_email_key unique (email)
);

comment on table public.clients is
  'Картка клієнта зрізу 1: лише ім''я та email. Створює планувальник або адміністратор.';

alter table public.clients enable row level security;

revoke all on table public.clients from anon, authenticated;
grant select on table public.clients to authenticated;
-- created_by і created_at ставлять default-и: користувач не підробить автора.
grant insert (full_name, email) on table public.clients to authenticated;
grant select, insert, update, delete on table public.clients to service_role;

create policy clients_select_staff
  on public.clients
  for select
  to authenticated
  using ((select private.is_scheduler_or_admin()));

create policy clients_insert_staff
  on public.clients
  for insert
  to authenticated
  with check (
    (select private.is_scheduler_or_admin())
    and created_by = (select auth.uid())
  );
-- update і delete для authenticated свідомо не видаємо: у зрізі 1 картку не редагують і не видаляють.
