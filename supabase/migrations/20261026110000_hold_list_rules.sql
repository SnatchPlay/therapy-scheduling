-- Список утримань планувальника за новими AC зрізу 1 (impl-client-card, design.md Р15).
-- AC-HOLD-37, AC-HOLD-38, AC-HOLD-42 (AC-HOLD-28/29 діють без змін).

set lock_timeout = '5s';

-- Той самий набір і порядок колонок, що в міграції past_status_and_expired_list: застосунок попередньої версії працює.
-- Рядок у списку — лише «Held» або «Expired» зі слотом, що ще не почався:
--   AC-HOLD-38: підтверджений сеанс — не утримання, його в списку немає;
--   AC-HOLD-29, AC-HOLD-42: слот почався (включно з моментом початку) — утримання, і «Held», і «Expired», зникає;
--   AC-HOLD-37: коли слот знову утримали за тим самим клієнтом, його старе прострочене утримання зникає.
-- Порядок за часом слоту від найближчого задає сторінка (order by starts_at): представлення порядку не гарантує.
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
where private.hold_status(h.confirmed_at, h.created_at) in ('Held', 'Expired')
  and not private.slot_started(s.starts_at)
  and not exists (
    select 1
    from public.holds as newer
    where newer.slot_id = h.slot_id and newer.client_id = h.client_id and newer.created_at > h.created_at
  );
