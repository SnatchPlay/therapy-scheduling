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

Вимоги: https://github.com/Sofiia-pm/therapy-scheduling-spec · джерело: issues · знімок 2026-10-25

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
| AC-HOLD-09 | терапевт бачить лише власний розклад | `src/app/schedule/page.tsx`, `supabase/migrations/20261021140000_slots_between.sql`, `supabase/migrations/20261019143036_slots_and_holds.sql` (holds_select, slots_select, therapists_select, clients_select_therapist) | `tests/db/schedule-db.test.ts`, `src/app/schedule/page.test.tsx` | реалізовано |
| AC-HOLD-10 | створення клієнта з ім'ям і email | `src/app/clients/actions.ts` (createClientCard), `supabase/migrations/20261019142745_roles_and_clients.sql` | `tests/db/clients-db.test.ts`, `src/app/clients/actions.test.ts` | реалізовано |
| AC-HOLD-11 | порожнє ім'я — відмова | `supabase/migrations/20261019142745_roles_and_clients.sql` (clients_full_name_check), `src/lib/messages.ts` | `tests/db/clients-db.test.ts` | реалізовано |
| AC-HOLD-12 | підтвердження — «Confirmed», без Held until | `supabase/migrations/20261019143503_confirm_holds.sql` (guard_confirm, confirm_hold, holds_one_session_per_slot), `src/app/holds/actions.ts`, `src/app/holds/page.tsx` | `tests/db/confirm-db.test.ts`, `src/app/holds/actions.test.ts`, `src/app/holds/page.test.tsx` | реалізовано |
| AC-HOLD-13 | прострочене не підтверджується | `supabase/migrations/20261019143503_confirm_holds.sql` (guard_confirm), `src/lib/messages.ts` | `tests/db/confirm-db.test.ts`, `src/app/holds/actions.test.ts` | реалізовано |
| AC-HOLD-14 | терапевт не підтверджує утримання | `supabase/migrations/20261019143503_confirm_holds.sql` (confirm_hold, holds_update_staff), `src/app/holds/actions.ts` | `tests/db/confirm-db.test.ts`, `src/app/holds/actions.test.ts` | реалізовано |
| AC-HOLD-15 | email без @ — відмова | `supabase/migrations/20261019142745_roles_and_clients.sql` (clients_email_check), `src/lib/messages.ts` | `tests/db/clients-db.test.ts` | реалізовано |
| AC-HOLD-16 | дубль email — відмова | `supabase/migrations/20261019142745_roles_and_clients.sql` (clients_email_key), `supabase/migrations/20261026100000_client_card.sql` (normalize_client), `src/lib/messages.ts` | `tests/db/clients-db.test.ts`, `src/app/clients/actions.test.ts` | реалізовано |
| AC-HOLD-17 | повторне утримання за тим самим клієнтом — відмова | `supabase/migrations/20261019143036_slots_and_holds.sql` (guard_new_hold) | `tests/db/holds-db.test.ts` | реалізовано |
| AC-HOLD-18 | немає вільних слотів — «No free slots on this day.» і під ним усі слоти зі статусами | `src/app/slots/page.tsx`, `src/lib/slots.ts` | `tests/db/holds-db.test.ts` | реалізовано |
| AC-HOLD-19 | адміністратор утримує й підтверджує | `supabase/migrations/20261019143503_confirm_holds.sql` (confirm_hold, holds_update_staff; `is_scheduler_or_admin`) | `tests/db/confirm-db.test.ts` | реалізовано |
| AC-HOLD-20 | «Expired» в утриманнях планувальника | `supabase/migrations/20261019143036_slots_and_holds.sql` (hold_list), `src/app/holds/page.tsx` | `tests/db/confirm-db.test.ts`, `src/app/holds/page.test.tsx` | реалізовано |
| AC-HOLD-21 | прострочене не в розкладі терапевта | `src/app/schedule/page.tsx`, `supabase/migrations/20261021140000_slots_between.sql`, `supabase/migrations/20261019143036_slots_and_holds.sql` (holds_select, slot_board) | `tests/db/schedule-db.test.ts`, `src/app/schedule/page.test.tsx` | реалізовано |
| AC-HOLD-22 | слот почався — не підтверджується, лишається «Held» | `supabase/migrations/20261019143503_confirm_holds.sql` (guard_confirm), `src/lib/messages.ts` | `tests/db/confirm-db.test.ts`, `src/app/holds/actions.test.ts` | реалізовано |
| AC-HOLD-23 | за хвилину до початку — підтверджується | `supabase/migrations/20261019143503_confirm_holds.sql` (guard_confirm) | `tests/db/confirm-db.test.ts` | реалізовано |
| AC-HOLD-24 | день без жодного слоту — лише повідомлення | `src/app/slots/page.tsx`, `src/lib/slots.ts`, `supabase/migrations/20261019143036_slots_and_holds.sql` (day_slots) | `tests/db/holds-db.test.ts` | реалізовано |
| AC-HOLD-25 | перетин часу клієнта в іншого терапевта — відмова | `supabase/migrations/20261021120000_client_overlap_and_reconfirm.sql` (guard_new_hold), `src/lib/messages.ts` | `tests/db/overlap-db.test.ts`, `src/app/slots/actions.test.ts` | реалізовано |
| AC-HOLD-26 | прострочене утримання не рахується перетином | `supabase/migrations/20261021120000_client_overlap_and_reconfirm.sql` (guard_new_hold) | `tests/db/overlap-db.test.ts` | реалізовано |
| AC-HOLD-27 | інший планувальник підтверджує утримання | `supabase/migrations/20261019143503_confirm_holds.sql` (holds_update_staff) | `tests/db/overlap-db.test.ts` | реалізовано |
| AC-HOLD-28 | прострочене утримання видно планувальнику до початку слоту | `supabase/migrations/20261021130000_past_status_and_expired_list.sql` (hold_list) | `tests/db/past-expired-db.test.ts` | реалізовано |
| AC-HOLD-29 | прострочене утримання не показано з початку слоту | `supabase/migrations/20261021130000_past_status_and_expired_list.sql` (hold_list) | `tests/db/past-expired-db.test.ts` | реалізовано |
| AC-HOLD-30 | розклад терапевта — поточний тиждень пн–нд зі слотами й статусами | `src/app/schedule/page.tsx`, `src/lib/time.ts` (weekStart), `supabase/migrations/20261021140000_slots_between.sql` | `tests/db/schedule-db.test.ts`, `src/app/schedule/page.test.tsx`, `src/lib/time.test.ts` | реалізовано |
| AC-HOLD-31 | перемикання на наступний тиждень | `src/app/schedule/page.tsx`, `src/lib/time.ts` (addDays) | `tests/db/schedule-db.test.ts`, `src/app/schedule/page.test.tsx`, `src/lib/time.test.ts` | реалізовано |
| AC-HOLD-32 | слот, що почався, — «Past», не вільний | `supabase/migrations/20261021130000_past_status_and_expired_list.sql` (slot_board), `src/app/slots/page.tsx` | `tests/db/past-expired-db.test.ts` | реалізовано |
| AC-HOLD-33 | «Past» не рахується вільним у «No free slots on this day.» | `supabase/migrations/20261021130000_past_status_and_expired_list.sql` (slot_board), `src/lib/slots.ts` | `tests/db/past-expired-db.test.ts`, `src/app/slots/page.test.tsx` | реалізовано |
| AC-HOLD-34 | email з іншим регістром і пробілами — дубль | `supabase/migrations/20261019142745_roles_and_clients.sql` (clients_email_key), `supabase/migrations/20261026100000_client_card.sql` (normalize_client) | `tests/db/clients-db.test.ts` | реалізовано |
| AC-HOLD-35 | email зберігається й показується нормалізованим | `supabase/migrations/20261026100000_client_card.sql` (normalize_client) | `tests/db/clients-db.test.ts` | реалізовано |
| AC-HOLD-36 | повторне підтвердження — «This hold is already confirmed.» | `supabase/migrations/20261021120000_client_overlap_and_reconfirm.sql` (guard_confirm), `src/lib/messages.ts` | `tests/db/confirm-db.test.ts`, `src/app/holds/actions.test.ts` | реалізовано |
| AC-CARD-01 | картка дорослого з анкети | `supabase/migrations/20261026100000_client_card.sql` (clients: обмеження, нормалізація, політики; own_client_ids) | `tests/db/client-card-db.test.ts` | відкладено (база готова в задачі 8, сторінки — задача 9) |
| AC-CARD-02 | картка дитини з опікуном | `supabase/migrations/20261026100000_client_card.sql` (clients: обмеження, нормалізація, політики; own_client_ids) | `tests/db/client-card-db.test.ts` | відкладено (база готова в задачі 8, сторінки — задача 9) |
| AC-CARD-03 | дитина без даних опікуна — відмова, дані лишаються | `supabase/migrations/20261026100000_client_card.sql` (clients: обмеження, нормалізація, політики; own_client_ids) | `tests/db/client-card-db.test.ts` | відкладено (база готова в задачі 8, сторінки — задача 9) |
| AC-CARD-04 | терапевт бачить картки своїх клієнтів (Held/Confirmed) | `supabase/migrations/20261026100000_client_card.sql` (clients: обмеження, нормалізація, політики; own_client_ids) | `tests/db/client-card-db.test.ts` | відкладено (база готова в задачі 8, сторінки — задача 9) |
| AC-CARD-05 | чужа картка за посиланням — «You don't have access to this client.» | `supabase/migrations/20261026100000_client_card.sql` (clients: обмеження, нормалізація, політики; own_client_ids) | `tests/db/client-card-db.test.ts` | відкладено (база готова в задачі 8, сторінки — задача 9) |
| AC-CARD-06 | терапевт не створює картки | `supabase/migrations/20261026100000_client_card.sql` (clients: обмеження, нормалізація, політики; own_client_ids) | `tests/db/client-card-db.test.ts` | відкладено (база готова в задачі 8, сторінки — задача 9) |
| AC-CARD-07 | без входу — лише сторінка входу | `supabase/migrations/20261026100000_client_card.sql` (clients: обмеження, нормалізація, політики; own_client_ids) | `tests/db/client-card-db.test.ts` | відкладено (база готова в задачі 8, сторінки — задача 9) |
| AC-CARD-08 | прострочене утримання не робить клієнта своїм | `supabase/migrations/20261026100000_client_card.sql` (clients: обмеження, нормалізація, політики; own_client_ids) | `tests/db/client-card-db.test.ts` | відкладено (база готова в задачі 8, сторінки — задача 9) |
| AC-CARD-09 | порожній список клієнтів терапевта | `supabase/migrations/20261026100000_client_card.sql` (clients: обмеження, нормалізація, політики; own_client_ids) | `tests/db/client-card-db.test.ts` | відкладено (база готова в задачі 8, сторінки — задача 9) |
| AC-CARD-10 | планувальник і адміністратор бачать усі картки | `supabase/migrations/20261026100000_client_card.sql` (clients: обмеження, нормалізація, політики; own_client_ids) | `tests/db/client-card-db.test.ts` | відкладено (база готова в задачі 8, сторінки — задача 9) |
| AC-CARD-11 | без ролі — лише повідомлення про відсутність доступу | `supabase/migrations/20261026100000_client_card.sql` (clients: обмеження, нормалізація, політики; own_client_ids) | `tests/db/client-card-db.test.ts` | відкладено (база готова в задачі 8, сторінки — задача 9) |
| AC-HOLD-37 | повторне утримання після прострочення за тим самим клієнтом | — | — | відкладено (чекає реалізації) |
| AC-HOLD-38 | список утримань: лише Held і Expired, за часом слоту | — | — | відкладено (чекає реалізації) |
| AC-HOLD-39 | інші некоректні email відхиляються | `supabase/migrations/20261026100000_client_card.sql` (is_valid_email, clients_email_check) | `tests/db/client-card-db.test.ts` | реалізовано |
| AC-HOLD-40 | терапевт бачить ім'я клієнта без email у розкладі | — | — | відкладено (чекає реалізації) |
| AC-HOLD-41 | ім'я з пробілами: порожнє відхиляється, краї прибираються | `supabase/migrations/20261026100000_client_card.sql` (normalize_client, has_visible_text) | `tests/db/client-card-db.test.ts` | реалізовано |
| AC-HOLD-42 | Held, слот якого почався, не в списку утримань | — | — | відкладено (чекає реалізації) |
