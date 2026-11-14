-- Ліміт чернеток картки з тексту звернення: не більше 10 запитів до моделі за годину на користувача (ADR 0008, design.md Р36).
-- Захист від зловживання платним Claude API: роль перевіряє дія requestIntakeDraft, ліміт — база. Вичерпаний ліміт
-- користувач бачить як «The assistant is unavailable right now…» (AC-INTAKE-08: «немає відповіді чи ліміт»).
set lock_timeout = '5s';

create table public.intake_draft_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index intake_draft_requests_user_time_idx on public.intake_draft_requests (user_id, created_at desc);

-- ── Права: ніхто через Data API ─────────────────────────────────────────────
-- Політик немає свідомо: прямий доступ authenticated не потрібен, а право delete на власні рядки дозволило б скинути
-- ліміт самому собі. Рядки пише лише private.take_intake_draft_slot (власник таблиці, RLS не заважає).
alter table public.intake_draft_requests enable row level security;
revoke all on table public.intake_draft_requests from anon, authenticated;
-- Identity-послідовність: Supabase за замовчуванням видає права на sequences у public, тож знімаємо й їх.
revoke all on sequence public.intake_draft_requests_id_seq from anon, authenticated;

-- ── Правило: перевірка й запис під блокуванням користувача ───────────────────
-- security definer лише в private. Блокування `pg_advisory_xact_lock` по користувачу: два одночасні запити не
-- проскочать обидва повз ліміт (перевірка й insert — одна транзакція). Час — clock_timestamp(): транзакція могла чекати блокування.
-- Старі рядки (понад добу) прибираємо тут же, тож таблиця не росте без меж.
create or replace function private.take_intake_draft_slot()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_used integer;
begin
  if v_user is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  delete from public.intake_draft_requests
  where user_id = v_user and created_at < clock_timestamp() - interval '1 day';

  select count(*) into v_used
  from public.intake_draft_requests
  where user_id = v_user and created_at > clock_timestamp() - interval '1 hour';

  if v_used >= 10 then
    return false;
  end if;

  insert into public.intake_draft_requests (user_id, created_at) values (v_user, clock_timestamp());
  return true;
end;
$$;

revoke execute on function private.take_intake_draft_slot() from public, anon;
grant execute on function private.take_intake_draft_slot() to authenticated;

-- Тонка обгортка для supabase.rpc: security invoker, лише для входу (anon — ні).
create or replace function public.take_intake_draft_slot()
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.take_intake_draft_slot();
$$;

revoke execute on function public.take_intake_draft_slot() from public, anon;
grant execute on function public.take_intake_draft_slot() to authenticated;
