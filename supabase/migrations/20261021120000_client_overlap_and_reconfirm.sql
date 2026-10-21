-- Відповіді PM (impl-slot-hold-answers, design.md Р8, Р9): AC-HOLD-25, AC-HOLD-26, AC-HOLD-36.

set lock_timeout = '5s';

-- Р8: утримання й сеанси одного клієнта не перетинаються в часі; прострочені не враховуються.
-- Тіло — private.guard_new_hold з міграції slots_and_holds + перевірка перетину.
create or replace function private.guard_new_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_now timestamptz;
begin
  -- Блокування рядка слоту: друга одночасна спроба чекає на першу й бачить її утримання (AC-HOLD-04).
  select s.starts_at, s.ends_at into v_starts_at, v_ends_at from public.slots as s where s.id = new.slot_id for update;
  if not found then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Час після замка: now() — початок транзакції, яка могла чекати на першу спробу.
  v_now := clock_timestamp();
  -- AC-HOLD-07; межа «з моменту початку включно» — як для підтвердження (AC-HOLD-22).
  if private.slot_started(v_starts_at, v_now) then
    raise exception 'SLOT_STARTED';
  end if;
  -- AC-HOLD-03, AC-HOLD-04, AC-HOLD-17: не більше одного активного утримання чи сеансу на слот.
  if exists (
    select 1 from public.holds as h
    where h.slot_id = new.slot_id and private.hold_status(h.confirmed_at, h.created_at, v_now) <> 'Expired'
  ) then
    raise exception 'SLOT_UNAVAILABLE';
  end if;

  -- AC-HOLD-25, AC-HOLD-26: клієнт не може бути на двох утриманнях чи сеансах одночасно. Слоти — різні рядки, тож замок
  -- слоту двох одночасних утримань одного клієнта не розрізняє: серіалізуємо їх замком клієнта. Порядок замків скрізь
  -- «слот → клієнт»; no key update не заважає перевірці зовнішнього ключа інших вставок.
  perform 1 from public.clients as c where c.id = new.client_id for no key update;
  -- Кінець одного = початок іншого — не перетин (requirements/product.md, «Перетин»).
  if exists (
    select 1
    from public.holds as h
    join public.slots as s on s.id = h.slot_id
    where h.client_id = new.client_id
      and private.hold_status(h.confirmed_at, h.created_at, v_now) <> 'Expired'
      and s.starts_at < v_ends_at
      and s.ends_at > v_starts_at
  ) then
    raise exception 'CLIENT_OVERLAP';
  end if;

  -- Час рахуємо з точністю до хвилини (припущення PM): утримання о 14:30:45 прострочується 14:30 наступного дня,
  -- як і показує «Held until».
  new.created_at := date_trunc('minute', v_now);
  new.created_by := coalesce((select auth.uid()), new.created_by);
  new.confirmed_at := null;
  new.confirmed_by := null;
  return new;
end;
$$;

-- Р9: повторне чи одночасне підтвердження — власне повідомлення (AC-HOLD-36) замість «слот недоступний».
-- Тіло — private.guard_confirm з міграції confirm_holds, змінено лише код першої відмови.
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

  -- Вже сеанс: повторне підтвердження не перезаписує, хто й коли підтвердив (AC-HOLD-36).
  if old.confirmed_at is not null then
    raise exception 'HOLD_ALREADY_CONFIRMED';
  end if;
  -- AC-HOLD-13: будь-яке прострочене утримання, навіть якщо слот уже утримали знову, — «Hold the slot again».
  -- Прострочене раніше за «слот почався»: утримання вже не діє (власне припущення, spec-reading). Перевірка саме тут
  -- закриває гонку «слот утримали за іншим клієнтом, поки це підтвердження чекало на замок»: на момент після замка
  -- старе утримання прострочене, тож двох «Confirmed» на слоті бути не може; unique-індекс — останній запобіжник.
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
