-- Відповіді PM (impl-slot-hold-answers, design.md Р11): AC-HOLD-30, AC-HOLD-31 — розклад терапевта на тиждень.

set lock_timeout = '5s';

-- Слоти терапевта за дні [p_from, p_to) часу практики America/Los_Angeles. Що таке «тиждень», вирішує застосунок
-- (src/lib/time.ts: понеділок–неділя, AC-HOLD-30), база лише віддає діапазон. security invoker: діє RLS slots, тож
-- терапевт із чужим therapist_id отримує порожній список (AC-HOLD-09); планувальник — слоти будь-якого терапевта.
create or replace function public.slots_between(p_therapist_id uuid, p_from date, p_to date)
returns setof public.slot_board
language sql
stable
security invoker
set search_path = ''
as $$
  select b.*
  from public.slot_board as b
  where b.therapist_id = p_therapist_id
    and b.starts_at >= (p_from::timestamp at time zone 'America/Los_Angeles')
    and b.starts_at < (p_to::timestamp at time zone 'America/Los_Angeles')
  order by b.starts_at;
$$;

revoke execute on function public.slots_between(uuid, date, date) from public, anon;
grant execute on function public.slots_between(uuid, date, date) to authenticated;

-- День — це діапазон з одного дня: одне визначення «слоти за дні» замість двох копій предиката.
create or replace function public.day_slots(p_therapist_id uuid, p_day date)
returns setof public.slot_board
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.slots_between(p_therapist_id, p_day, p_day + 1);
$$;
