# Запис екрана прод-URL (зріз 1)

`slot-hold-prod.mp4` — 50 с на https://therapy-scheduling-weld.vercel.app, синтетичні користувачі `scheduler1@example.test` і `therapist1@example.test`, вхід за кадром (паролів у кадрі немає).

| Час | Ролі | Що видно | AC |
|---|---|---|---|
| 0:00 | планувальник | `/slots` на сьогодні: слоти, що вже почались, — «Past», решта — «Free» | AC-HOLD-32 |
| 0:08 | планувальник | `/slots` на 2026-12-15: у Therapist One о 10:00 — «Confirmed», client1 | AC-HOLD-01 |
| 0:15 | планувальник | спроба утримати за client1 слот Therapist Two о 10:00 — «This client already has a hold or session at this time.» | AC-HOLD-25 |
| 0:22 | планувальник | `/holds`: єдине утримання — «Confirmed» | AC-HOLD-12, 20 |
| 0:28 | терапевт | `/` → `/schedule`: поточний тиждень 2026-10-19 – 2026-10-25, слоти зі статусами | AC-HOLD-30 |
| 0:38 | терапевт | «Next week» до тижня 2026-12-14 – 2026-12-20: вівторок 10:00 — «Confirmed», client1; тижні перемикаються | AC-HOLD-31, 09 |

Дані запису в прод-базі: клієнт `client1` (`client1@example.test`), одне утримання на 2026-12-15 о 10:00 у Therapist One, підтверджене планувальником. Спроба пересічення нічого не створила (перевірено списком `/holds` після запису).
