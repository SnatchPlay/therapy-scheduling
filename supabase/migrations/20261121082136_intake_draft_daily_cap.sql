-- Загальна добова стеля чернеток: не більше 200 запитів до моделі за добу на всіх користувачів разом (фідбек WS10, порада 2).
-- Ліміт 10 на годину на користувача (міграція intake_draft_quota) не обмежує загальні витрати: багато користувачів по 10 на
-- годину — це багато платних викликів. Тепер код сам обмежує рахунок за API. Вичерпана стеля — те саме «The assistant is
-- unavailable right now…» (AC-INTAKE-08), форма працює вручну.
set lock_timeout = '5s';

-- Індекс не додаємо: рядків за дизайном не більше ~200 (вставка закрита стелею, старі видаляються щоразу).

-- Один глобальний замок замість замка на користувача: і ліміт користувача, і загальна стеля перевіряються й записуються під ним,
-- тож два одночасні запити від різних користувачів не проскочать обидва повз стелю. Виклик короткий (рахунок за індексом).
-- Права, обгортка й revoke від quota-міграції лишаються: create or replace їх зберігає. Налаштування функції повторюємо.
create or replace function private.take_intake_draft_slot()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_user_hour integer;
  v_all_day integer;
begin
  if v_user is null then
    return false;
  end if;

  -- Роль — частина правила в базі: функцію можна викликати через Data API напряму, а стелю спільна. Без цієї перевірки
  -- терапевт чи будь-хто з входом вичерпав би добову стелю, не звертаючись до моделі, і планувальники лишилися б без помічника.
  if coalesce((select private.current_app_role()), '') not in ('admin', 'scheduler') then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('take_intake_draft_slot', 0));

  -- Старі рядки (понад добу) прибираємо всі, не лише користувача: вони не рахуються ні в ліміті, ні в стелі.
  delete from public.intake_draft_requests where created_at < clock_timestamp() - interval '1 day';

  select count(*) filter (where user_id = v_user and created_at > clock_timestamp() - interval '1 hour'), count(*)
    into v_user_hour, v_all_day
  from public.intake_draft_requests;

  if v_user_hour >= 10 or v_all_day >= 200 then
    return false;
  end if;

  insert into public.intake_draft_requests (user_id, created_at) values (v_user, clock_timestamp());
  return true;
end;
$$;
