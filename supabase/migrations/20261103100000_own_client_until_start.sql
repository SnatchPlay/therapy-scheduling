-- «Свій клієнт» до початку слоту (AC-CARD-14, AC-CARD-04; відповідь PM на Sofiia-pm/therapy-scheduling-spec#25).
-- Терапевт бачить картку клієнта, поки утримання «Held» ще не прострочене й слот не почався (з моменту початку
-- включно картка недоступна), або без обмеження в часі, якщо сеанс підтверджено. Сигнатура, права й політика
-- clients_select_therapist не міняються: create or replace зберігає права виконання.
set lock_timeout = '5s';

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
