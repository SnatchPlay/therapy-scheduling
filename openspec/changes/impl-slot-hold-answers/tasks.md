# Tasks

## 5. Перетин клієнта, повторне підтвердження, email (PR `task/overlap-confirm`)

- [x] 5.1 Міграція: `CLIENT_OVERLAP` у `guard_new_hold` із замком клієнта, `HOLD_ALREADY_CONFIRMED` у `guard_confirm`
- [x] 5.2 Тести бази: перетин (в іншого терапевта, прострочене, межа «кінець = початок»), підтвердження іншим планувальником, повторне підтвердження, email з регістром і пробілами; одночасність (два утримання клієнта, два підтвердження) — гонка на Postgres 17 у quality trial, у PGlite її не відтворити
- [x] 5.3 Повідомлення PM у `src/lib/messages.ts` і server actions

Done when: AC-HOLD-25, AC-HOLD-26, AC-HOLD-27, AC-HOLD-34, AC-HOLD-35, AC-HOLD-36

## 6. «Past» і прострочене до початку слоту (PR `task/past-expired`)

- [x] 6.1 Міграція: статус «Past» у `slot_board`, прострочене в `hold_list` лише до початку слоту
- [x] 6.2 Тести бази й сторінка `/slots`: «Past» замість «Started», «No free slots on this day.» без «Past»

Done when: AC-HOLD-28, AC-HOLD-29, AC-HOLD-32, AC-HOLD-33

## 7. Розклад терапевта на тиждень (PR `task/week-schedule`)

- [ ] 7.1 Міграція: `slots_between` (діапазон днів; `day_slots` через неї); `src/lib/time.ts` — понеділок тижня
- [ ] 7.2 Сторінка `/schedule`: тиждень, перемикання, слоти зі статусами; тести бази й сторінки
- [ ] 7.3 Archive `impl-slot-hold-answers`, запис екрана з прод-URL

Done when: AC-HOLD-30, AC-HOLD-31 (і далі AC-HOLD-09, AC-HOLD-21)
