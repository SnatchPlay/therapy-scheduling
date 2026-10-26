# Tasks

## 8. Картка клієнта й доступ у базі (PR `task/client-card-db`)

- [x] 8.1 Міграція: колонки картки, обмеження, нормалізація й дата народження, права на колонки, nullable `profiles.role`
- [x] 8.2 Політики `clients`: `select` для staff, `select` для терапевта через `private.own_client_ids()`, `insert` для staff
- [x] 8.3 Тести бази з таблицею мутацій (в описі PR); `database.types.ts` оновлено вручну за форматом генератора (підсумок `db-check` не публікується в логах)

Done when: AC-CARD-01, AC-CARD-02, AC-CARD-03, AC-CARD-04, AC-CARD-05, AC-CARD-06, AC-CARD-08, AC-CARD-09,
AC-CARD-10, AC-HOLD-39, AC-HOLD-41 (на рівні бази; користувач без ролі й без входу — AC-CARD-07, AC-CARD-11 тестами бази)

## 9. Сторінки картки клієнта (PR `task/client-card-ui`)

- [ ] 9.1 `/clients`, `/clients/new`, `/clients/[id]`; повідомлення; `Card` і історії Storybook
- [ ] 9.2 Користувач без ролі на `/`; email опікуна у виборі клієнта на `/slots`; демо-користувач newuser1
- [ ] 9.3 Модульні тести сторінок і дій

Done when: AC-CARD-01…11 на рівні застосунку

## 10. Списки зрізу 1 за новими AC (PR `task/hold-list-rules`)

- [ ] 10.1 Міграція `hold_list`: лише «Held»/«Expired», слот не почався, повторне утримання ховає старе прострочене
- [ ] 10.2 `/holds`: порядок за часом слоту; тести бази й сторінки

Done when: AC-HOLD-37, AC-HOLD-38, AC-HOLD-40, AC-HOLD-42

## 11. Архітектурне правило й ADR (PR `task/action-auth-rule`)

- [ ] 11.1 ADR про ролі й «свій клієнт» у базі
- [ ] 11.2 `scripts/check-action-auth.mjs`: кожна server action перевіряє сесію (`getClaims`); тест і доказ на порушенні
- [ ] 11.3 Крок CI `architecture.yml`

Done when: AC-CARD-06, AC-CARD-07, AC-CARD-11 (правило не дає дії обійти перевірку сесії; відмови цих AC уже в тестах задач 8–9)
