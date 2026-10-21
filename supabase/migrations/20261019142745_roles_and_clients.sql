-- Ролі зрізу 1 і картка клієнта (impl-slot-hold, design.md Р1–Р2).
-- AC-HOLD-10, AC-HOLD-11, AC-HOLD-15, AC-HOLD-16; ролі — матриця прав requirements/product.md.

-- profiles читає кожен запит застосунку: не чекати чужого блокування довше за 5 с (db-deploy краще впаде).
set lock_timeout = '5s';

-- ── Ролі: admin, scheduler, therapist замість member, admin шаблону ─────────
-- Порядок із заголовка 20261012000000_profiles_and_roles.sql: старий constraint → дані → default → новий constraint.
alter table public.profiles drop constraint profiles_role_check;
-- design.md Р1: старі демо-акаунти member стають scheduler.
update public.profiles set role = 'scheduler' where role = 'member';
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
-- Знаки, які користувач не бачить: пробіли, табуляції, переноси, нерозривні й нульової ширини. Unicode — явно,
-- бо [:space:] для не-ASCII залежить від локалі бази. Одне джерело для імені (AC-HOLD-11) і email (AC-HOLD-15, 16).
create or replace function private.blank_chars()
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select '[:space:]\u00a0\u1680\u180e\u2000-\u200d\u2028\u2029\u202f\u205f\u2060\u3000\u3164\ufeff';
$$;

revoke execute on function private.blank_chars() from public, anon;
-- Обмеження таблиці виконуються з правами того, хто пише рядок; service_role (скрипти, виправлення даних) теж пише.
grant usage on schema private to service_role;
grant execute on function private.blank_chars() to authenticated, service_role;

create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  email      text not null,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  -- AC-HOLD-11: порожнє ім'я не приймаємо: потрібен хоч один видимий знак.
  constraint clients_full_name_check check (full_name ~ ('[^' || private.blank_chars() || ']')),
  -- AC-HOLD-15: email — один знак @ з текстом до й після, без невидимих знаків.
  constraint clients_email_check
    check (email ~ ('^[^@' || private.blank_chars() || ']+@[^@' || private.blank_chars() || ']+$')),
  -- AC-HOLD-16: email унікальний; тригер нижче зберігає його без невидимих знаків по краях і в нижньому регістрі.
  constraint clients_email_key unique (email)
);

-- AC-HOLD-16: Client1@Example.test і « client1@example.test » — той самий email (нормалізація даних,
-- docs/spec-reading.md «Власні припущення»). Тригер, а не код застосунку: прямий insert через Data API теж.
create or replace function private.normalize_client_email()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(regexp_replace(
    new.email,
    '^[' || private.blank_chars() || ']+|[' || private.blank_chars() || ']+$',
    '',
    'g'
  ));
  return new;
end;
$$;

revoke execute on function private.normalize_client_email() from public, anon, authenticated;

create trigger clients_normalize_email
  before insert or update of email on public.clients
  for each row execute function private.normalize_client_email();

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
