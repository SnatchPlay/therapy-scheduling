-- Number of live holds per therapist, for the staff holds screen header.
set lock_timeout = '5s';

create or replace function private.live_hold_count(p_therapist uuid)
returns bigint
language sql
stable
security definer
as $$
  select count(*)
  from public.holds as h
  join public.slots as s on s.id = h.slot_id
  where s.therapist_id = p_therapist
    and h.confirmed_at is null;
$$;

revoke execute on function private.live_hold_count(uuid) from public, anon;
grant execute on function private.live_hold_count(uuid) to authenticated;
