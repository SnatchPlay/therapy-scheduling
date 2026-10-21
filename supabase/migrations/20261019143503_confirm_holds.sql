-- Підтвердження утримання в сеанс (impl-slot-hold, design.md Р4).
-- AC-HOLD-12, AC-HOLD-13, AC-HOLD-14, AC-HOLD-19, AC-HOLD-22, AC-HOLD-23.

-- Колонку confirmed_at змінює лише цей шлях: значення ставить тригер, тож прямий PATCH через Data API = confirm_hold.
grant update (confirmed_at) on table public.holds to authenticated;

create policy holds_update_staff
  on public.holds
  for update
  to authenticated
  using ((select private.is_scheduler_or_admin()))
  with check ((select private.is_scheduler_or_admin()));

create or replace function private.guard_confirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_starts_at timestamptz;
  v_now timestamptz;
begin
  -- Той самий замок, що й під час утримання: підтвердження й нове утримання слоту не перетинаються.
  select s.starts_at into v_starts_at from public.slots as s where s.id = old.slot_id for update;
  -- Час після замка: транзакція могла чекати на інше утримання довше за межу 24 годин.
  v_now := clock_timestamp();

  -- Вже сеанс, або поки ця транзакція чекала, слот утримав хтось інший (утримання прострочилось на межі):
  -- без цього на одному слоті опинялись два «Confirmed» (рев'ю бази, High).
  if old.confirmed_at is not null or exists (
    select 1 from public.holds as h
    where h.slot_id = old.slot_id and h.id <> old.id
      and private.hold_status(h.confirmed_at, h.created_at, v_now) <> 'Expired'
  ) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;
  -- AC-HOLD-13. Прострочене раніше за «слот почався»: утримання вже не діє (власне припущення, spec-reading).
  if private.hold_status(old.confirmed_at, old.created_at, v_now) = 'Expired' then
    raise exception 'HOLD_EXPIRED';
  end if;
  -- AC-HOLD-22, AC-HOLD-23: з моменту початку слоту включно — відмова; утримання лишається «Held».
  if private.slot_started(v_starts_at, v_now) then
    raise exception 'CONFIRM_SLOT_STARTED';
  end if;

  new.confirmed_at := v_now;
  new.confirmed_by := coalesce((select auth.uid()), new.confirmed_by);
  return new;
end;
$$;

revoke execute on function private.guard_confirm() from public, anon, authenticated;

create trigger holds_guard_confirm
  before update of confirmed_at on public.holds
  for each row execute function private.guard_confirm();

-- Останній запобіжник: на слоті не більше одного сеансу, хоч би що сталося з тригерами.
create unique index holds_one_session_per_slot on public.holds (slot_id) where confirmed_at is not null;

-- Підтвердження від імені користувача: роль перевіряємо тут, щоб терапевт отримав власне повідомлення (AC-HOLD-14).
create or replace function public.confirm_hold(p_hold_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.is_scheduler_or_admin()) then
    raise exception 'CONFIRM_FORBIDDEN' using errcode = '42501';
  end if;
  update public.holds set confirmed_at = now() where id = p_hold_id;
  if not found then
    raise exception 'HOLD_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.confirm_hold(uuid) from public, anon;
grant execute on function public.confirm_hold(uuid) to authenticated;
