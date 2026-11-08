-- Статус перевірки страхування в картці клієнта (impl-insurance-status, design.md Р23; ADR 0005).
-- AC-INS-01…05 (AC-INS-06 — без входу — діє за ADR 0004: proxy, а дані віддає лише RLS).
set lock_timeout = '5s';

-- «Not set» — початкове значення для кожної картки, зокрема створених у зрізах 1–2 (AC-INS-01): not null default дає його
-- наявним рядкам без окремого оновлення даних.
alter table public.clients
  add column insurance_status text not null default 'Not set',
  add constraint clients_insurance_status_check
    check (insurance_status in ('Not set', 'Verified', 'Not accepted', 'Private pay'));

-- ── Повнота картки — лише для нових карток (design.md Р27) ───────────────────
-- clients_complete_check був not valid: Postgres перевіряє такий check і на кожному оновленому рядку, тож картка зрізу 1
-- без дати народження й мови (PM: вона лишається дійсною, «Not provided») не дала б змінити статус, хоч статус — інша
-- колонка. Правило «нова картка повна» лишається, але лише на insert: тригер дає ту саму помилку (23514,
-- clients_complete_check), а оновлення старої картки його не зачіпає. Тригер — after insert: так він спрацьовує після RLS
-- і решти обмежень, як і check раніше, тож відмова терапевту (RLS) і помилки про тип чи опікуна лишаються першими.
alter table public.clients drop constraint clients_complete_check;

create or replace function private.require_complete_card()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date is null or new.session_language is null then
    raise exception using
      errcode = 'check_violation',
      constraint = 'clients_complete_check',
      message = 'new row for relation "clients" violates check constraint "clients_complete_check"';
  end if;
  return new;
end;
$$;

revoke execute on function private.require_complete_card() from public, anon, authenticated;

create trigger clients_require_complete
  after insert on public.clients
  for each row execute function private.require_complete_card();

-- Право змінювати лише цю колонку (ADR 0005): решта колонок картки не редагується (ADR 0004). Читання — наявний
-- table-wide select: статус бачить той, кому RLS віддає картку (AC-INS-03, 04).
grant update (insurance_status) on table public.clients to authenticated;

-- Змінює лише планувальник чи адміністратор (AC-INS-02, 03). Терапевт політики на update не має: його запит не бачить
-- жодного рядка, нуль зачеплених, статус не змінюється (AC-INS-05). with check — «Not set» лише початковий: позначити
-- можна три інші значення й змінювати між ними, повернути «Not set» не можна (припущення PM, design.md Р23).
create policy clients_update_insurance_staff
  on public.clients
  for update
  to authenticated
  using ((select private.is_scheduler_or_admin()))
  with check (insurance_status in ('Verified', 'Not accepted', 'Private pay'));
