-- Терапевти, слоти й утримання слоту за клієнтом (impl-slot-hold, design.md Р3–Р5).
-- AC-HOLD-01…08, AC-HOLD-17, AC-HOLD-18; видимість терапевта — AC-HOLD-09, AC-HOLD-21.

-- Політика нижче змінює public.clients, яку читає кожна сторінка планувальника: не чекати чужого замка довше 5 с.
set lock_timeout = '5s';

-- ── Таблиці ─────────────────────────────────────────────────────────────────
create table public.therapists (
  id        uuid primary key default gen_random_uuid(),
  -- Користувач-терапевт — профіль із тим самим email (profiles.email ставить тригер з Auth, користувач його не змінює).
  email     text not null unique,
  full_name text not null
);

create table public.slots (
  id           uuid primary key default gen_random_uuid(),
  therapist_id uuid not null references public.therapists (id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  constraint slots_therapist_start_key unique (therapist_id, starts_at),
  -- Припущення PM: кожен слот триває 60 хвилин.
  constraint slots_duration_check check (ends_at = starts_at + interval '60 minutes')
);

create table public.holds (
  id           uuid primary key default gen_random_uuid(),
  slot_id      uuid not null references public.slots (id) on delete cascade,
  client_id    uuid not null references public.clients (id),
  created_by   uuid not null default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id)
);

create index holds_slot_id_idx on public.holds (slot_id);
create index holds_client_id_idx on public.holds (client_id);

comment on table public.holds is
  'Утримання слоту за клієнтом. Статус не зберігається: Confirmed — є confirmed_at; Expired — минуло 24 години від created_at; інакше Held (private.hold_status).';

-- ── Хелпери ─────────────────────────────────────────────────────────────────
-- Єдине визначення строку утримання й «слот почався». interval '24 hours' — рівно 1440 хвилин і під час переходу
-- на літній/зимовий час (припущення PM).
create or replace function private.hold_expires_at(p_created_at timestamptz)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select p_created_at + interval '24 hours';
$$;

-- З моменту початку включно (AC-HOLD-07; для підтвердження — AC-HOLD-22).
-- p_at — момент перевірки: now() для читання, clock_timestamp() після замка в тригерах (транзакція могла чекати).
create or replace function private.slot_started(p_starts_at timestamptz, p_at timestamptz default now())
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_starts_at <= p_at;
$$;

create or replace function private.hold_status(
  p_confirmed_at timestamptz,
  p_created_at timestamptz,
  p_at timestamptz default now()
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_confirmed_at is not null then 'Confirmed'
    when p_at >= private.hold_expires_at(p_created_at) then 'Expired'
    else 'Held'
  end;
$$;

-- Терапевт поточного користувача (лише з роллю therapist).
create or replace function private.current_therapist_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
  from public.therapists as t
  join public.profiles as p on p.email = t.email
  where p.id = (select auth.uid()) and p.role = 'therapist';
$$;

revoke execute on function private.hold_expires_at(timestamptz), private.slot_started(timestamptz, timestamptz),
  private.hold_status(timestamptz, timestamptz, timestamptz), private.current_therapist_id()
  from public, anon;
grant execute on function private.hold_expires_at(timestamptz), private.slot_started(timestamptz, timestamptz),
  private.hold_status(timestamptz, timestamptz, timestamptz), private.current_therapist_id()
  to authenticated;

-- ── RLS і права ─────────────────────────────────────────────────────────────
alter table public.therapists enable row level security;
alter table public.slots enable row level security;
alter table public.holds enable row level security;

revoke all on table public.therapists, public.slots, public.holds from anon, authenticated;
-- Терапевтів і слоти готують початкові дані (міграція нижче): authenticated лише читає.
grant select on table public.therapists, public.slots to authenticated;
grant select on table public.holds to authenticated;
-- Решту колонок ставить тригер private.guard_new_hold.
grant insert (slot_id, client_id) on table public.holds to authenticated;
grant select, insert, update, delete on table public.therapists, public.slots, public.holds to service_role;

create policy therapists_select
  on public.therapists
  for select
  to authenticated
  using ((select private.is_scheduler_or_admin()) or id = (select private.current_therapist_id()));

create policy slots_select
  on public.slots
  for select
  to authenticated
  using ((select private.is_scheduler_or_admin()) or therapist_id = (select private.current_therapist_id()));

-- Терапевт бачить лише утримання власних слотів і без прострочених (AC-HOLD-09, AC-HOLD-21).
-- Підзапит, а не функція на кожен рядок: множину власних слотів Postgres рахує один раз.
create policy holds_select
  on public.holds
  for select
  to authenticated
  using (
    (select private.is_scheduler_or_admin())
    or (
      slot_id in (select s.id from public.slots as s where s.therapist_id = (select private.current_therapist_id()))
      and private.hold_status(confirmed_at, created_at) <> 'Expired'
    )
  );

create policy holds_insert_staff
  on public.holds
  for insert
  to authenticated
  with check ((select private.is_scheduler_or_admin()) and created_by = (select auth.uid()));

-- Терапевт бачить лише клієнтів утримань, які бачить сам: RLS holds уже лишає власні непрострочені.
-- Для staff ця політика нічого не додає (clients_select_staff), і множину клієнтів Postgres рахує один раз.
create policy clients_select_therapist
  on public.clients
  for select
  to authenticated
  using (id in (select h.client_id from public.holds as h));

-- ── Правила утримання (останні ворота і для прямих запитів Data API) ────────
create or replace function private.guard_new_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_starts_at timestamptz;
  v_now timestamptz;
begin
  -- Блокування рядка слоту: друга одночасна спроба чекає на першу й бачить її утримання (AC-HOLD-04).
  select s.starts_at into v_starts_at from public.slots as s where s.id = new.slot_id for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Час після замка: now() — початок транзакції, яка могла чекати на першу спробу.
  v_now := clock_timestamp();
  -- AC-HOLD-07; межа «з моменту початку включно» — як для підтвердження (AC-HOLD-22).
  if private.slot_started(v_starts_at, v_now) then
    raise exception 'SLOT_STARTED';
  end if;
  -- AC-HOLD-03, AC-HOLD-04, AC-HOLD-17: не більше одного активного утримання чи сеансу на слот.
  if exists (
    select 1 from public.holds as h
    where h.slot_id = new.slot_id and private.hold_status(h.confirmed_at, h.created_at, v_now) <> 'Expired'
  ) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  -- Час рахуємо з точністю до хвилини (припущення PM): утримання о 14:30:45 прострочується 14:30 наступного дня,
  -- як і показує «Held until».
  new.created_at := date_trunc('minute', v_now);
  new.created_by := coalesce((select auth.uid()), new.created_by);
  new.confirmed_at := null;
  new.confirmed_by := null;
  return new;
end;
$$;

revoke execute on function private.guard_new_hold() from public, anon, authenticated;

create trigger holds_guard_new_hold
  before insert on public.holds
  for each row execute function private.guard_new_hold();

-- Утримання від імені користувача: роль перевіряємо тут, щоб терапевт отримав власне повідомлення (AC-HOLD-08).
create or replace function public.hold_slot(p_slot_id uuid, p_client_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (select private.is_scheduler_or_admin()) then
    raise exception 'HOLD_FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.holds (slot_id, client_id) values (p_slot_id, p_client_id) returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.hold_slot(uuid, uuid) from public, anon;
grant execute on function public.hold_slot(uuid, uuid) to authenticated;

-- ── Читання: слоти зі статусом (RLS таблиць діє через security_invoker) ─────
create view public.slot_board
with (security_invoker = true)
as
select
  s.id as slot_id,
  s.therapist_id,
  t.full_name as therapist_name,
  s.starts_at,
  s.ends_at,
  h.id as hold_id,
  h.client_id,
  c.full_name as client_name,
  case when h.id is not null and h.confirmed_at is null then private.hold_expires_at(h.created_at) end as held_until,
  case when h.id is null then 'Free' else private.hold_status(h.confirmed_at, h.created_at) end as status,
  (h.id is null and not private.slot_started(s.starts_at)) as holdable
from public.slots as s
join public.therapists as t on t.id = s.therapist_id
left join lateral (
  select x.id, x.client_id, x.created_at, x.confirmed_at
  from public.holds as x
  where x.slot_id = s.id and private.hold_status(x.confirmed_at, x.created_at) <> 'Expired'
  order by x.created_at desc
  limit 1
) as h on true
left join public.clients as c on c.id = h.client_id;

revoke all on table public.slot_board from anon, authenticated;
grant select on table public.slot_board to authenticated;

-- Усі утримання зі статусом Held / Expired / Confirmed (AC-HOLD-06, AC-HOLD-20); терапевту RLS лишає власні без Expired.
create view public.hold_list
with (security_invoker = true)
as
select
  h.id as hold_id,
  h.slot_id,
  s.therapist_id,
  t.full_name as therapist_name,
  s.starts_at,
  s.ends_at,
  h.client_id,
  c.full_name as client_name,
  h.created_at,
  case when h.confirmed_at is null then private.hold_expires_at(h.created_at) end as held_until,
  h.confirmed_at,
  private.hold_status(h.confirmed_at, h.created_at) as status
from public.holds as h
join public.slots as s on s.id = h.slot_id
join public.therapists as t on t.id = s.therapist_id
join public.clients as c on c.id = h.client_id;

revoke all on table public.hold_list from anon, authenticated;
grant select on table public.hold_list to authenticated;

-- Слоти одного дня терапевта за часом практики America/Los_Angeles (AC-HOLD-01, AC-HOLD-18).
create or replace function public.day_slots(p_therapist_id uuid, p_day date)
returns setof public.slot_board
language sql
stable
security invoker
set search_path = ''
as $$
  select b.*
  from public.slot_board as b
  where b.therapist_id = p_therapist_id
    and b.starts_at >= (p_day::timestamp at time zone 'America/Los_Angeles')
    and b.starts_at < ((p_day + 1)::timestamp at time zone 'America/Los_Angeles')
  order by b.starts_at;
$$;

revoke execute on function public.day_slots(uuid, date) from public, anon;
grant execute on function public.day_slots(uuid, date) to authenticated;

-- ── Початкові дані: терапевти й доступність (припущення PM: сид, слоти по 60 хвилин з початку години) ──
-- Сид у хмарі вже виконано один раз, тож довідкові дані — у міграції, ідемпотентно.
insert into public.therapists (email, full_name)
values ('therapist1@example.test', 'Therapist One'), ('therapist2@example.test', 'Therapist Two')
on conflict (email) do nothing;

insert into public.slots (therapist_id, starts_at, ends_at)
select
  t.id,
  (d + make_interval(hours => h)) at time zone 'America/Los_Angeles',
  (d + make_interval(hours => h)) at time zone 'America/Los_Angeles' + interval '60 minutes'
from public.therapists as t
cross join generate_series(timestamp '2026-10-19', timestamp '2026-12-31', interval '1 day') as d
cross join generate_series(9, 16) as h
where t.email in ('therapist1@example.test', 'therapist2@example.test')
  and extract(isodow from d) < 6
on conflict (therapist_id, starts_at) do nothing;
