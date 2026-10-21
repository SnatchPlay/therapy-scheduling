# Матриця відповідності (AC → код → тест → статус)

<!--
Ваша матриця: один рядок на кожен AC з openspec/specs/** — вашої специфікації, у яку ви перекладаєте вимоги PM
(їхній знімок у requirements/ приносить команда агента /requirements-sync).
Рядок «Вимоги» під цим коментарем заповнює лише /requirements-sync: адреса репо вимог PM, звідки взято вимоги (issues
або файли docs/), і дата знімка, через « · ». Руками його не змінюйте: з нього /requirements-sync знає, звідки брати
вимоги наступного разу, а скіли spec-clarify, spec-review і /conformance — куди ставити питання й яку версію вимог ви
реалізуєте. Рядків таблиці /requirements-sync не додає.
Рядки змінюєте ви:
  PR «Специфікація» — після archive зміни: рядок кожного нового AC зі статусом «відкладено (чекає реалізації)»; рядки AC,
                      прибраних зі специфікації (REMOVED), — видалити;
  PR «Реалізація»   — рядок AC задачі в тому самому PR, що й код і тест.
Перебудувати автоматично: /conformance (Claude Code, Cursor).
Перевірка в CI: npm run ac:coverage — падає, якщо
  NO-ROW     AC є в специфікації, а рядка немає (типово — PR «Специфікація» без нових рядків або рядок видалено);
  MISSING    статус «реалізовано», а непропущеного тесту, назва якого починається з цього AC ID, у файлах
             *.test.ts / *.test.tsx немає (*.spec.ts і допоміжні файли Vitest не запускає — вони не рахуються);
  ORPHAN     тест посилається на AC, якого немає в специфікації (AC прибрано або вимогу PM ще не перекладено);
  BAD-STATUS статус не «реалізовано» і не «відкладено (причина)»;
  WRONG-REF  шляху `src/…`/`tests/…`/`supabase/…` з колонок «Код»/«Тест» немає або тест із цим AC в іншому файлі;
і попереджає, не падаючи: AC з вимог PM (requirements/), якого ще немає в openspec/specs/, — «вимогу PM ще не перекладено
в специфікацію».

Приклад рядків (усередині коментаря — скрипт їх не читає):
| AC-LEAVE-02 | заявка на дві посади дає два записи main і additional | `src/app/requests/actions.ts` (createRequest) | `tests/requests.test.ts` | реалізовано |
| AC-LEAVE-04 | заблоковані дні не рахуються | — | — | відкладено (чекаю відповідь PM на Q2, <pm>/<team-slug>-spec#5) |
| AC-LEAVE-07 | менеджер бачить лише свій відділ | — | — | відкладено (рішення PM: поза зрізом 1, <pm>/<team-slug>-spec#8) |
| AC-LEAVE-10 | діапазон лише із заблокованих днів | — | — | відкладено (чекає реалізації) |
-->

Вимоги: https://github.com/Sofiia-pm/therapy-scheduling-spec · джерело: issues · знімок 2026-10-21

| AC | Що перевіряє | Код | Тест | Статус |
|---|---|---|---|---|
| AC-HOLD-01 | слоти дня: вільний, «Held», «Confirmed»; утримати лише вільний | `supabase/migrations/20261019143036_slots_and_holds.sql` (slot_board, day_slots), `src/app/slots/page.tsx` | `tests/db/holds-db.test.ts` | реалізовано |
| AC-HOLD-02 | утримання вільного слоту: «Held», клієнт, Held until +24 год | `supabase/migrations/20261019143036_slots_and_holds.sql` (hold_slot, guard_new_hold), `src/app/slots/actions.ts`, `src/lib/time.ts` | `tests/db/holds-db.test.ts`, `src/lib/time.test.ts`, `src/app/slots/actions.test.ts` | реалізовано |
| AC-HOLD-03 | слот уже утримано — «This slot is no longer available.» | `supabase/migrations/20261019143036_slots_and_holds.sql` (guard_new_hold), `src/lib/messages.ts` | `tests/db/holds-db.test.ts`, `src/app/slots/actions.test.ts` | реалізовано |
| AC-HOLD-04 | два одночасні утримання — рівно одне | `supabase/migrations/20261019143036_slots_and_holds.sql` (guard_new_hold: `for update` на слоті) | `tests/db/holds-db.test.ts` | реалізовано |
| AC-HOLD-05 | за хвилину до 24 год — досі «Held» | `supabase/migrations/20261019143036_slots_and_holds.sql` (hold_status, hold_expires_at) | `tests/db/holds-db.test.ts` | реалізовано |
| AC-HOLD-06 | через 24 год — «Expired», слот вільний | `supabase/migrations/20261019143036_slots_and_holds.sql` (hold_status, slot_board) | `tests/db/holds-db.test.ts` | реалізовано |
| AC-HOLD-07 | слот почався — «This slot has already started and cannot be held.» | `supabase/migrations/20261019143036_slots_and_holds.sql` (slot_started у guard_new_hold) | `tests/db/holds-db.test.ts` | реалізовано |
| AC-HOLD-08 | терапевт не утримує слот | `supabase/migrations/20261019143036_slots_and_holds.sql` (hold_slot, holds_insert_staff) | `tests/db/holds-db.test.ts` | реалізовано |
| AC-HOLD-09 | терапевт бачить лише власний розклад | `src/app/schedule/page.tsx`, `supabase/migrations/20261019143036_slots_and_holds.sql` (holds_select, slots_select, therapists_select, clients_select_therapist) | `tests/db/schedule-db.test.ts`, `src/app/schedule/page.test.tsx` | реалізовано |
| AC-HOLD-10 | створення клієнта з ім'ям і email | `src/app/clients/actions.ts` (createClientCard), `supabase/migrations/20261019142745_roles_and_clients.sql` | `tests/db/clients-db.test.ts`, `src/app/clients/actions.test.ts` | реалізовано |
| AC-HOLD-11 | порожнє ім'я — відмова | `supabase/migrations/20261019142745_roles_and_clients.sql` (clients_full_name_check), `src/lib/messages.ts` | `tests/db/clients-db.test.ts` | реалізовано |
| AC-HOLD-12 | підтвердження — «Confirmed», без Held until | `supabase/migrations/20261019143503_confirm_holds.sql` (guard_confirm, confirm_hold, holds_one_session_per_slot), `src/app/holds/actions.ts`, `src/app/holds/page.tsx` | `tests/db/confirm-db.test.ts`, `src/app/holds/actions.test.ts`, `src/app/holds/page.test.tsx` | реалізовано |
| AC-HOLD-13 | прострочене не підтверджується | `supabase/migrations/20261019143503_confirm_holds.sql` (guard_confirm), `src/lib/messages.ts` | `tests/db/confirm-db.test.ts`, `src/app/holds/actions.test.ts` | реалізовано |
| AC-HOLD-14 | терапевт не підтверджує утримання | `supabase/migrations/20261019143503_confirm_holds.sql` (confirm_hold, holds_update_staff), `src/app/holds/actions.ts` | `tests/db/confirm-db.test.ts`, `src/app/holds/actions.test.ts` | реалізовано |
| AC-HOLD-15 | email без @ — відмова | `supabase/migrations/20261019142745_roles_and_clients.sql` (clients_email_check), `src/lib/messages.ts` | `tests/db/clients-db.test.ts` | реалізовано |
| AC-HOLD-16 | дубль email — відмова | `supabase/migrations/20261019142745_roles_and_clients.sql` (clients_email_key, normalize_client_email), `src/lib/messages.ts` | `tests/db/clients-db.test.ts`, `src/app/clients/actions.test.ts` | реалізовано |
| AC-HOLD-17 | повторне утримання за тим самим клієнтом — відмова | `supabase/migrations/20261019143036_slots_and_holds.sql` (guard_new_hold) | `tests/db/holds-db.test.ts` | реалізовано |
| AC-HOLD-18 | немає вільних слотів — «No free slots on this day.» і під ним усі слоти зі статусами | `src/app/slots/page.tsx`, `src/lib/slots.ts` | `tests/db/holds-db.test.ts` | реалізовано |
| AC-HOLD-19 | адміністратор утримує й підтверджує | `supabase/migrations/20261019143503_confirm_holds.sql` (confirm_hold, holds_update_staff; `is_scheduler_or_admin`) | `tests/db/confirm-db.test.ts` | реалізовано |
| AC-HOLD-20 | «Expired» в утриманнях планувальника | `supabase/migrations/20261019143036_slots_and_holds.sql` (hold_list), `src/app/holds/page.tsx` | `tests/db/confirm-db.test.ts`, `src/app/holds/page.test.tsx` | реалізовано |
| AC-HOLD-21 | прострочене не в розкладі терапевта | `src/app/schedule/page.tsx`, `supabase/migrations/20261019143036_slots_and_holds.sql` (holds_select, slot_board) | `tests/db/schedule-db.test.ts`, `src/app/schedule/page.test.tsx` | реалізовано |
| AC-HOLD-22 | слот почався — не підтверджується, лишається «Held» | `supabase/migrations/20261019143503_confirm_holds.sql` (guard_confirm), `src/lib/messages.ts` | `tests/db/confirm-db.test.ts`, `src/app/holds/actions.test.ts` | реалізовано |
| AC-HOLD-23 | за хвилину до початку — підтверджується | `supabase/migrations/20261019143503_confirm_holds.sql` (guard_confirm) | `tests/db/confirm-db.test.ts` | реалізовано |
| AC-HOLD-24 | день без жодного слоту — лише повідомлення | `src/app/slots/page.tsx`, `src/lib/slots.ts`, `supabase/migrations/20261019143036_slots_and_holds.sql` (day_slots) | `tests/db/holds-db.test.ts` | реалізовано |
