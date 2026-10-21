-- Відповіді PM (impl-slot-hold-answers, design.md Р10): AC-HOLD-28, AC-HOLD-29, AC-HOLD-32, AC-HOLD-33.

set lock_timeout = '5s';

-- AC-HOLD-32: слот без активного утримання чи сеансу, що вже почався, — «Past» (не вільний, утримати не можна).
-- Підтверджений сеанс лишається «Confirmed», активне утримання — «Held» до прострочення. holdable не змінюється.
-- AC-HOLD-33: «Past» не вільний, тож повідомлення «No free slots on this day.» рахується за holdable без змін.
-- Той самий набір і порядок колонок, що в міграції slots_and_holds: змінено лише вираз status.
create or replace view public.slot_board
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
  case
    when h.id is not null then private.hold_status(h.confirmed_at, h.created_at)
    when private.slot_started(s.starts_at) then 'Past'
    else 'Free'
  end as status,
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

-- AC-HOLD-28, AC-HOLD-29: прострочене утримання планувальник бачить лише до початку слоту (з моменту початку включно —
-- ні): прострочене корисне, поки клієнту можна передзвонити. Правило — у представленні, яке і є «списком утримань»;
-- таблицю holds планувальник читає цілком (її читають підтвердження й тригери). Колонки ті самі, що в slots_and_holds.
create or replace view public.hold_list
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
join public.clients as c on c.id = h.client_id
where not (private.hold_status(h.confirmed_at, h.created_at) = 'Expired' and private.slot_started(s.starts_at));
