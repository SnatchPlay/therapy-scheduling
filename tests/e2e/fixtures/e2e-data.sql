-- Передумови e2e на одноразовій базі (job `E2E: Playwright`, .github/workflows/e2e.yml) після scripts/create-demo-users.mjs:
--   AC-CARD-05 — клієнт, що є «своїм» лише для therapist2 (для therapist1 його немає): його дає утримання «Held» у слоті
--                therapist2, поки слот не почався;
--   AC-HOLD-44 — у списку утримань планувальника є хоча б одне утримання (підтверджені сеанси там не показують, AC-HOLD-38).
-- Одного утримання досить для обох. Воно діє 24 години, тож файл — для бази, яку створили для прогону; на тривалій локальній
-- базі спершу `supabase db reset`. У сид і в міграції файл не входить, на прод його ніхто не виконує.
-- Слот — відносно now(): береться слот therapist2 на цей час або створюється, якщо слотів немає (слоти в міграціях закінчуються
-- 2026-12-31). Ідемпотентно: повторний запуск нічого не дублює. Лише синтетичні дані (*@example.test).
do $$
declare
  v_scheduler uuid := (select id from public.profiles where email = 'scheduler1@example.test');
  v_starts_at timestamptz := date_trunc('hour', now()) + interval '2 days';
  v_client uuid;
  v_slot uuid;
begin
  if v_scheduler is null then
    raise exception 'немає акаунта scheduler1@example.test: спершу scripts/create-demo-users.mjs';
  end if;
  if exists (select 1 from public.clients where email = 'uat-ac-card-05@example.test') then
    return;
  end if;

  insert into public.clients (full_name, email, birth_date, session_language, created_by)
  values ('UAT AC-CARD-05 Client', 'uat-ac-card-05@example.test', date '1990-01-01', 'English', v_scheduler)
  returning id into v_client;

  insert into public.slots (therapist_id, starts_at, ends_at)
  select id, v_starts_at, v_starts_at + interval '60 minutes'
  from public.therapists
  where email = 'therapist2@example.test'
  on conflict (therapist_id, starts_at) do nothing;

  select s.id into v_slot
  from public.slots as s
  join public.therapists as t on t.id = s.therapist_id
  where t.email = 'therapist2@example.test' and s.starts_at = v_starts_at;

  insert into public.holds (slot_id, client_id, created_by) values (v_slot, v_client, v_scheduler);
end;
$$;
