-- Повнота картки в базі, усі помилки форми за один запит, дублікат картки дитини
-- (impl-clarify-client-card, design.md Р18, Р19; AC-CARD-12, AC-CARD-13).
set lock_timeout = '5s';

-- ── Спільні правила тексту й дати ───────────────────────────────────────────
-- Тригер normalize_client і функція client_card_errors мають однаково прибирати пробіли по краях і рахувати «сьогодні»:
-- одне джерело для обох, інакше правила розійдуться.
create or replace function private.trim_blank(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(p_text, '^[' || private.blank_chars() || ']+|[' || private.blank_chars() || ']+$', '', 'g');
$$;

-- «Сьогодні» за часом практики (America/Los_Angeles): дата народження не може бути пізнішою (AC-CARD-12).
create or replace function private.practice_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Los_Angeles')::date;
$$;

-- Дата лише у форматі РРРР-ММ-ДД: звичайне приведення до date приймає й `06.05.1990` (як 5 червня), `epoch`, `-infinity`.
create or replace function private.parse_iso_date(p_text text)
returns date
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
begin
  if p_text is null or p_text !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return p_text::date;
exception
  when others then
    return null; -- неіснуюча дата, наприклад 2026-02-30
end;
$$;

revoke execute on function private.trim_blank(text), private.practice_today(), private.parse_iso_date(text) from public, anon;
grant execute on function private.trim_blank(text), private.practice_today(), private.parse_iso_date(text)
  to authenticated, service_role;

create or replace function private.normalize_client()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.full_name := private.trim_blank(new.full_name);
  new.guardian_name := private.trim_blank(new.guardian_name);
  new.email := lower(private.trim_blank(new.email));
  new.guardian_email := lower(private.trim_blank(new.guardian_email));
  -- AC-CARD-01: дата народження — не пізніше за сьогодні в часі практики. check з now() не підходить (не immutable).
  if new.birth_date is not null and new.birth_date > private.practice_today() then
    raise exception 'INVALID_BIRTH_DATE';
  end if;
  return new;
end;
$$;

-- ── Дублікат картки дитини (AC-CARD-13) ─────────────────────────────────────
-- Ім'я без пробілів по краях і email опікуна малими літерами вже нормалізує тригер; регістр імені — тут. Якщо в базі вже
-- є дві однакові картки дитини, індекс не створиться, міграція відкотиться цілком (схема лишиться старою): перед merge
-- перевіряємо select … group by … having count(*) > 1 (design.md Р19). Індекс — до обмеження нижче: те бере ACCESS
-- EXCLUSIVE на таблицю до кінця транзакції, тож його ставимо останнім, щоб читання clients стояли якомога коротше.
-- (мутація: без унікального індексу)

-- ── Повнота картки ──────────────────────────────────────────────────────────
-- not valid, як clients_email_check: картки зрізу 1 (без дати й мови) лишаються дійсними, а нові й змінені перевіряються;
-- пряме створення через Data API форму не оминає. Наявні рядки перевірку не проходять (convalidated = false). Побічно:
-- будь-який UPDATE такого старого рядка (навіть від service_role) теж перевіряється, тож виправляючи його, дату й мову
-- вказують разом. UPDATE по clients у застосунку немає.
alter table public.clients
  add constraint clients_complete_check check (birth_date is not null and session_language is not null) not valid;

-- ── Усі помилки картки за один запит (AC-CARD-12) ───────────────────────────
-- Повертає коди повідомлень (MESSAGES у застосунку) у порядку полів форми, кожен один раз. Правила ті самі, що в
-- обмеженнях і тригері таблиці clients, на тих самих помічниках; обмеження лишаються останньою брамою, а тест бази
-- звіряє, що функція й вони згодні. Не вона вирішує право створювати: для терапевта — лише CARD_FORBIDDEN.
create or replace function public.client_card_errors(p_card jsonb)
returns text[]
language plpgsql
stable
set search_path = ''
as $$
declare
  v_type text;
  v_name text;
  v_date date;
  v_language text;
  v_errors text[] := '{}';
begin
  if not private.is_scheduler_or_admin() then
    return array['CARD_FORBIDDEN'];
  end if;

  -- Лише після перевірки ролі: довгий ввід від терапевта не доходить до регулярних виразів.
  v_type := p_card ->> 'client_type';
  v_name := private.trim_blank(p_card ->> 'full_name');
  v_date := private.parse_iso_date(p_card ->> 'birth_date');
  v_language := p_card ->> 'session_language';

  if v_type is null or v_type not in ('Adult', 'Child') then
    v_errors := array_append(v_errors, 'INVALID_TYPE');
  end if;

  -- Ім'я й email дорослого — одне повідомлення на пару; для дитини й невибраного типу — лише про ім'я.
  if not coalesce(private.has_visible_text(v_name), false)
     or (v_type = 'Adult' and not coalesce(private.is_valid_email(lower(private.trim_blank(p_card ->> 'email'))), false)) then
    v_errors := array_append(v_errors, case when v_type = 'Adult' then 'INVALID_CLIENT' else 'INVALID_CLIENT_NAME' end);
  end if;

  if v_date is null or v_date > private.practice_today() then
    v_errors := array_append(v_errors, 'INVALID_BIRTH_DATE');
  end if;

  if v_language is null or v_language not in ('English', 'Spanish') then
    v_errors := array_append(v_errors, 'INVALID_LANGUAGE');
  end if;

  if v_type = 'Child'
     and (not coalesce(private.has_visible_text(private.trim_blank(p_card ->> 'guardian_name')), false)
          or not coalesce(private.is_valid_email(lower(private.trim_blank(p_card ->> 'guardian_email'))), false)) then
    v_errors := array_append(v_errors, 'INVALID_GUARDIAN');
  end if;

  return v_errors;
end;
$$;

revoke execute on function public.client_card_errors(jsonb) from public, anon;
grant execute on function public.client_card_errors(jsonb) to authenticated;
