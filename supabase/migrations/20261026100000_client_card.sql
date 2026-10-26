-- Картка клієнта з анкети й доступ до карток (impl-client-card, design.md Р12–Р13).
-- AC-CARD-01…11, AC-HOLD-39, AC-HOLD-41.

-- clients і profiles читає кожен запит застосунку: не чекати чужого блокування довше за 5 с.
set lock_timeout = '5s';

-- ── Користувач без ролі (AC-CARD-11) ────────────────────────────────────────
-- Найменші права — «жодних»: раніше нова людина без ролі ставала therapist. Тепер role порожня, а
-- private.current_app_role() повертає null, тож is_scheduler_or_admin() і current_therapist_id() дають false.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles alter column role drop not null;
alter table public.profiles alter column role drop default;
alter table public.profiles
  add constraint profiles_role_check check (role is null or role in ('admin', 'scheduler', 'therapist'));

-- ── Одне джерело для «видимого тексту» й «коректного email» (AC-HOLD-11, 15, 39, 41; опікун — AC-CARD-03) ──
create or replace function private.has_visible_text(p_text text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_text ~ ('[^' || private.blank_chars() || ']');
$$;

-- AC-HOLD-39: рівно один «@», непорожні частини до й після нього, крапка в частині після «@», без невидимих знаків.
create or replace function private.is_valid_email(p_email text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select p_email ~ ('^[^@' || private.blank_chars() || ']+@[^@' || private.blank_chars() || ']*\.[^@' || private.blank_chars() || ']*$');
$$;

revoke execute on function private.has_visible_text(text), private.is_valid_email(text) from public, anon;
-- Обмеження таблиці виконуються з правами того, хто пише рядок (authenticated, service_role).
grant execute on function private.has_visible_text(text), private.is_valid_email(text) to authenticated, service_role;

-- ── Колонки картки ──────────────────────────────────────────────────────────
-- Картки зрізу 1 лишаються дійсними: тип «Adult», решта полів порожня («Not provided»). Дату народження й мову база не
-- вимагає: обов'язковість полів форми картки (AC-CARD-01) — у server action, поки PM не відповіла на Sofiia-pm/therapy-scheduling-spec#20.
alter table public.clients
  add column client_type text not null default 'Adult',
  add column birth_date date,
  add column session_language text,
  add column guardian_name text,
  add column guardian_email text;

-- Дитина не має власного email: контакт — email опікуна.
alter table public.clients alter column email drop not null;

alter table public.clients drop constraint clients_full_name_check;
alter table public.clients drop constraint clients_email_check;

alter table public.clients
  add constraint clients_full_name_check check (private.has_visible_text(full_name)),
  -- not valid: картка зрізу 1 могла мати email без крапки після «@» (старе правило цього не вимагало); нові й змінені рядки
  -- перевіряються, наявні не валять міграцію на проді.
  add constraint clients_email_check check (email is null or private.is_valid_email(email)) not valid,
  add constraint clients_client_type_check check (client_type in ('Adult', 'Child')),
  add constraint clients_session_language_check check (session_language is null or session_language in ('English', 'Spanish')),
  -- AC-CARD-03: опікуна вказано, якщо вказано; ім'я видиме, email коректний.
  add constraint clients_guardian_check check (
    (guardian_name is null or private.has_visible_text(guardian_name))
    and (guardian_email is null or private.is_valid_email(guardian_email))
  ),
  -- Дорослий: власний email, без опікуна. Дитина: без власного email, з опікуном (ім'я й email).
  add constraint clients_adult_shape_check check (
    client_type <> 'Adult' or (email is not null and guardian_name is null and guardian_email is null)
  ),
  add constraint clients_child_shape_check check (
    client_type <> 'Child' or (email is null and guardian_name is not null and guardian_email is not null)
  );

comment on table public.clients is
  'Картка клієнта: тип (Adult/Child), ім''я, дата народження, мова сеансів, email (дорослий) або опікун (дитина). Створює планувальник або адміністратор.';

-- ── Нормалізація й дата народження ──────────────────────────────────────────
-- AC-HOLD-16, 35: email — малими літерами без невидимих знаків по краях; AC-HOLD-41: те саме для імені (без зміни
-- регістру). Тригер, а не код застосунку: прямий insert через Data API теж.
create or replace function private.normalize_client()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_edges constant text := '^[' || private.blank_chars() || ']+|[' || private.blank_chars() || ']+$';
begin
  new.full_name := regexp_replace(new.full_name, v_edges, '', 'g');
  new.guardian_name := regexp_replace(new.guardian_name, v_edges, '', 'g');
  new.email := lower(regexp_replace(new.email, v_edges, '', 'g'));
  new.guardian_email := lower(regexp_replace(new.guardian_email, v_edges, '', 'g'));
  -- AC-CARD-01: дата народження — не пізніше за сьогодні в часі практики. check з now() не підходить (не immutable).
  if new.birth_date is not null and new.birth_date > (now() at time zone 'America/Los_Angeles')::date then
    raise exception 'INVALID_BIRTH_DATE';
  end if;
  return new;
end;
$$;

revoke execute on function private.normalize_client() from public, anon, authenticated;

drop trigger clients_normalize_email on public.clients;
drop function private.normalize_client_email();

create trigger clients_normalize
  before insert or update on public.clients
  for each row execute function private.normalize_client();

-- ── Права на колонки ────────────────────────────────────────────────────────
-- Читання — наявний table-wide grant select (нові колонки читає той, кому RLS дозволяє рядок).
grant insert (client_type, birth_date, session_language, guardian_name, guardian_email)
  on table public.clients to authenticated;

-- ── Свої клієнти терапевта (AC-CARD-04, 08, 09) ─────────────────────────────
-- «Свій клієнт» — клієнт із утриманням «Held» (не прострочене) або сеансом «Confirmed» у слотах цього терапевта
-- (requirements/product.md, «Свій клієнт»). Явна множина, а не підзапит до holds під RLS: зміна політики holds_select
-- мовчки не відкриє чужих клієнтів. security definer — лише в private, set-based: один підзапит на запит.
create or replace function private.own_client_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select h.client_id
  from public.holds as h
  join public.slots as s on s.id = h.slot_id
  where s.therapist_id = (select private.current_therapist_id())
    and private.hold_status(h.confirmed_at, h.created_at) in ('Held', 'Confirmed');
$$;

revoke execute on function private.own_client_ids() from public, anon;
grant execute on function private.own_client_ids() to authenticated;

drop policy clients_select_therapist on public.clients;
create policy clients_select_therapist
  on public.clients
  for select
  to authenticated
  using (id in (select private.own_client_ids()));
