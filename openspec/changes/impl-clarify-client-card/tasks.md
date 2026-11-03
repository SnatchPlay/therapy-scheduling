# Tasks

## 12. «Свій клієнт» до початку слоту (PR `task/own-client-until-start`)

- [x] 12.1 Міграція: `private.own_client_ids()` — «Held» лише до початку слоту, «Confirmed» без обмеження (Р17)
- [x] 12.2 Тести бази за прийомом AC-HOLD-42 (межа 09:59 / 10:00, минулий «Confirmed», чужий клієнт) і сторінки `/clients`; мутаційна таблиця й червоний прогін у PR
- [x] 12.3 Тест `AC-HOLD-43` у `tests/db/hold-list-db.test.ts` (Р22; міграції не потрібно)
- [x] 12.4 Рядки `docs/conformance.md` для AC-CARD-04, AC-CARD-14, AC-HOLD-43

Done when: AC-CARD-04, AC-CARD-14, AC-HOLD-43

## 13. Відмови з текстом замість перенаправлення (PR `task/denied-pages`)

- [ ] 13.1 Компонент `AccessDenied`; `/clients/new` (AC-CARD-06), `/slots` і `/holds` (AC-HOLD-44) для терапевта
- [ ] 13.2 `holdSlot` і `confirmHold`: відмова ролі — на `/schedule?msg=…`; оновити коментарі про головну (Р20)
- [ ] 13.3 `/clients`: порожній список staff (AC-CARD-15); `/clients/[id]`: картки немає (AC-CARD-16); «Sign out» у тесті без ролі (AC-CARD-11)
- [ ] 13.4 Тести сторінок і дій перевіряють показ тексту, а не лише адресу; відхилення #47 і #48 закрити коментарем із посиланням на PR

Done when: AC-CARD-06, AC-CARD-11, AC-CARD-15, AC-CARD-16, AC-HOLD-44

## 14. Повнота картки, усі помилки одразу, дублікат (PR `task/card-completeness`)

- [ ] 14.1 Міграція: `check (birth_date is not null and session_language is not null) not valid`; унікальний індекс дитини; `client_card_errors(jsonb)` (Р18, Р19)
- [ ] 14.2 Фікстура `ensureClient` і тест AC-HOLD-10: картка лише з ім'ям та email більше не створюється
- [ ] 14.3 Дія `createClientCard` і форма: усі помилки одразу біля полів, порожній пункт типу, `CLIENT_DUPLICATE`; `DESIGN.md` §5, §6
- [ ] 14.4 Тест бази «функція й обмеження згодні»; тести дублікатів (регістр, пробіли, близнюки) й форми

Done when: AC-CARD-12, AC-CARD-13 (і AC-CARD-01, 03, AC-HOLD-10, 11, 15, 16, 34, 35, 39, 41 лишаються зеленими в повній формі)

## 15. Пошук клієнта під час утримання (PR `task/client-picker-search`)

- [ ] 15.1 `filterClients` і поле «Find a client» на `/slots` (Р21)
- [ ] 15.2 Тест AC-CARD-02: client7 знаходять за email опікуна, біля нього показано email опікуна

Done when: AC-CARD-02

## 16. Повторний мутаційний доказ для відмов (PR `task/mutation-proof-card`)

- [ ] 16.1 Мутація `src/app/clients/[id]/page.tsx` (терапевт відкриває чужу картку, `lint` і `typecheck` зелені) — коміт `mutation:`, червоний прогін, revert
- [ ] 16.2 Мутація `requireRole` (пускає без ролі) — те саме; у журналі прогону видно крок `npm test` і назви червоних тестів
- [ ] 16.3 Таблиця «AC → що прибрали → який тест упав» у PR; `docs/evidence/` — посилання на прогони

Done when: AC-CARD-05, AC-CARD-08, AC-CARD-11 (відмови доведено тестами, які падають)

## 17. Тест гонки двох утримань на справжньому Postgres (PR `task/hold-race-test`)

- [ ] 17.1 Крок `db-check`: скрипт із двома з'єднаннями `pg` — сесія A тримає `hold_slot` у транзакції через `pg_sleep`, сесія B на той самий слот отримує «This slot is no longer available.»; те саме для двох слотів одного клієнта (AC-HOLD-25)
- [ ] 17.2 Мутаційний коміт без `for update` у `guard_new_hold` має почервоніти крок; `docs/conformance.md`: AC-HOLD-04 — тест, що доводить гонку

Done when: AC-HOLD-04, AC-HOLD-25
