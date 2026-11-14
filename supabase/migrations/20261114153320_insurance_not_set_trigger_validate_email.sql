-- Виправлення за фідбеком WS9 (ADR 0007): з clients прибираємо рядкові правила, що блокують update інших колонок.
-- AC-INS-02 (повернути «Not set» не можна; статус можна позначити й у старої картки).
set lock_timeout = '5s';

-- ── clients_email_check: not valid → validated ───────────────────────────────
-- Check «not valid» Postgres перевіряє на кожному оновленому рядку, хоч би яку колонку змінювали: картка зрізу 1 з email
-- без крапки після «@» не дала б змінити жодну колонку (зокрема статус). validate constraint перевіряє всі наявні рядки й
-- під час db-deploy або проходить, або зупиняє застосування міграції з помилкою — а не ламає збереження мовчки.
alter table public.clients validate constraint clients_email_check;

-- ── «Not set» — лише початковий статус: тригер замість with check ─────────────
-- Правило жило в with check політики clients_update_insurance_staff. Через нього будь-яка інша відмова на update (наприклад,
-- відсутнє колонкове право) для картки з початковим статусом приходила як 42501 від RLS, а друга дозвільна політика на
-- update через OR тихо дозволила б повернути «Not set». Тригер не залежить від політик і відмовляє однаково для всіх ролей.
-- Спрацьовує лише коли insurance_status є в SET: інші оновлення картки його не зачіпають.
create or replace function private.forbid_insurance_not_set()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.insurance_status = 'Not set' then
    raise exception using
      errcode = 'insufficient_privilege',
      message = 'permission denied: статус «Not set» не повернути';
  end if;
  return new;
end;
$$;

revoke execute on function private.forbid_insurance_not_set() from public, anon, authenticated;

create trigger clients_insurance_not_set
  before update of insurance_status on public.clients
  for each row execute function private.forbid_insurance_not_set();

-- Політиці лишається перевірка ролі: в with check — та сама, що в using (без with check Postgres застосував би using).
-- Значення поза списком відхиляє check таблиці clients_insurance_status_check (23514) для всіх, зокрема service_role.
alter policy clients_update_insurance_staff
  on public.clients
  with check ((select private.is_scheduler_or_admin()));
