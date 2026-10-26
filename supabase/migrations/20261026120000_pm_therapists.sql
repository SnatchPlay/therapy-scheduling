-- Терапевти для акаунтів PM (supabase/pm-users.json, npm run users:pm): звʼязок профілю з терапевтом — за email
-- (private.current_therapist_id), тож рядки therapists потрібні до першого входу pm-therapist і pm-therapist2.
-- Дані синтетичні; доступність — як у терапевтів зрізу 1 (будні, слоти по 60 хвилин з 09:00 до 16:00 за часом практики).
-- Ідемпотентно: повторний запуск нічого не дублює.

insert into public.therapists (email, full_name)
values ('pm-therapist@example.test', 'PM Therapist One'), ('pm-therapist2@example.test', 'PM Therapist Two')
on conflict (email) do nothing;

insert into public.slots (therapist_id, starts_at, ends_at)
select
  t.id,
  (d + make_interval(hours => h)) at time zone 'America/Los_Angeles',
  (d + make_interval(hours => h)) at time zone 'America/Los_Angeles' + interval '60 minutes'
from public.therapists as t
cross join generate_series(timestamp '2026-10-26', timestamp '2026-12-31', interval '1 day') as d
cross join generate_series(9, 16) as h
where t.email in ('pm-therapist@example.test', 'pm-therapist2@example.test')
  and extract(isodow from d) < 6
on conflict (therapist_id, starts_at) do nothing;
