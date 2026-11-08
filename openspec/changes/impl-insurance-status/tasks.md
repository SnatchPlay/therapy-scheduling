# Tasks

## 18. Статус страхування в базі (PR `task/insurance-status-db`)

- [ ] 18.1 Міграція: колонка `insurance_status` (`not null default 'Not set'`, `check`), `grant update (insurance_status)`, політика `clients_update_insurance_staff` із `with check` (Р23)
- [ ] 18.2 Тести бази `tests/db/insurance-status-db.test.ts`: статус за замовчуванням, планувальник і адміністратор змінюють, терапевт читає лише своїх і не змінює (нуль рядків), «Not set» не повернути; таблиця мутацій в описі PR
- [ ] 18.3 `database.types.ts` (підсумок `db-check` або `npm run db:types`); перевірка на проді запитом лише для читання, що картки з email без крапки відсутні (Р23, «Ризики»)
- [ ] 18.4 ADR 0005 «Колонковий update статусу страхування» — лише після погодження власника (Р23)

Done when: AC-INS-01, AC-INS-02, AC-INS-03, AC-INS-04, AC-INS-05 (на рівні бази; AC-INS-06 — задача 19)

## 19. Картка показує статус, форма для планувальника й адміністратора (PR `task/insurance-status-ui`)

- [ ] 19.1 `CLIENT_COLUMNS`, `ClientCardData`, рядок `Insurance: <статус>` у `ClientCard`; історії Storybook картки, якщо вони є, — зі статусами
- [ ] 19.2 Форма «Verified / Not accepted / Private pay» + «Save» на `/clients/[id]` лише для STAFF; server action `setInsuranceStatus` (`getViewer()` першим оператором); `INSURANCE_SAVED` у `MESSAGES` і `SUCCESS_CODES`; `?msg=` на сторінці картки
- [ ] 19.3 Модульні тести сторінки й дії (форми немає в терапевта; нуль рядків — без «saved»; без входу — лише вхід), `messages.test.ts`; `npm run check:actions`, `check:design`
- [ ] 19.4 Візуальна перевірка картки в обох темах і на вузькому екрані (скіл `visual-verify`)

Done when: AC-INS-01…06 на рівні застосунку

## 20. UAT на проді й proof pack (PR `task/insurance-status-uat`)

- [ ] 20.1 Сценарій `tests/e2e/insurance-status.spec.ts` (за зразком `client-card.spec.ts`) і дані `tests/e2e/fixtures/e2e-data.sql`, якщо потрібні картки client6, client7
- [ ] 20.2 UAT на проді на кожен AC: запис, кадри, `manifest.json`, вердикт агента (`npm run uat`, `uat:review`) у `docs/qa/uat/<дата>`; дані лише синтетичні, зміни статусу — з прибиранням після себе
- [ ] 20.3 Розділ зрізу 3 у `docs/qa/proof-pack.md`; рядки `docs/conformance.md` AC-INS → «реалізовано»; archive `impl-insurance-status`

Done when: AC-INS-01…06 доведено на проді (UAT-запис і вердикт агента)
