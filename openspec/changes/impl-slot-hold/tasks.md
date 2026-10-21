# Tasks

## 1. Ролі й картка клієнта (PR `task/clients`)

- [x] 1.1 Міграція: ролі `admin` / `scheduler` / `therapist`, таблиця `clients` з обмеженнями, GRANT і RLS; `supabase/demo-users.json`
- [x] 1.2 Тестова база PGlite (`tests/db/supabase-pglite.ts`, з посиланням на джерело) і тести бази для клієнта
- [x] 1.3 Сторінка `/clients` і server action створення клієнта з повідомленнями PM

Done when: AC-HOLD-10, AC-HOLD-11, AC-HOLD-15, AC-HOLD-16

## 2. Слоти й утримання (PR `task/slot-holds`)

- [ ] 2.1 Міграція: `therapists`, `slots` з початковими даними, `holds`, тригер утримання з блокуванням слоту, `hold_slot`, `slot_board`, `day_slots`, RLS терапевта
- [ ] 2.2 Тести бази: статуси дня, утримання, зайнятий і розпочатий слот, роль, межа 24 годин
- [ ] 2.3 Сторінка `/slots` (терапевт + день, утримання за клієнтом, «No free slots on this day.»), формат часу

Done when: AC-HOLD-01, AC-HOLD-02, AC-HOLD-03, AC-HOLD-04, AC-HOLD-05, AC-HOLD-06, AC-HOLD-07, AC-HOLD-08, AC-HOLD-17, AC-HOLD-18, AC-HOLD-24

## 3. Підтвердження й утримання планувальника (PR `task/confirm`)

- [ ] 3.1 Міграція: тригер підтвердження, `confirm_hold`, `hold_list`
- [ ] 3.2 Тести бази: підтвердження, прострочене, розпочатий слот, роль, адміністратор, «Expired» у списку
- [ ] 3.3 Сторінка `/holds` з кнопкою підтвердження

Done when: AC-HOLD-12, AC-HOLD-13, AC-HOLD-14, AC-HOLD-19, AC-HOLD-20, AC-HOLD-22, AC-HOLD-23

## 4. Розклад терапевта (PR `task/therapist-schedule`)

- [ ] 4.1 Сторінка `/schedule`: власні утримання й сеанси без прострочених, слоти обраного дня
- [ ] 4.2 Тести бази: лише власний розклад, прострочене не показано
- [ ] 4.3 Archive `impl-slot-hold`, запис екрана з прод-URL

Done when: AC-HOLD-09, AC-HOLD-21
