# Мутаційний доказ відмов доступу до картки (AC-CARD-05, 08, 11)

Кожну відмову зламано окремим комітом `mutation:` у PR [#56](https://github.com/SnatchPlay/therapy-scheduling/pull/56). У всіх прогонах `lint` і `typecheck` зелені, червоний лише крок `npm test` (джоба `app`). Після кожного прогону коміт відкочено `git revert`; код PR збігається з `main`.

| AC | Що зламано | Червоні тести | Прогін CI |
|---|---|---|---|
| AC-CARD-05, 16 | `src/app/clients/[id]/page.tsx`: терапевту показано «картки немає» замість відмови (умова `STAFF.includes(role)` інвертована) | `src/app/clients/[id]/page.test.tsx`: два тести AC-CARD-05 і тест AC-CARD-16 | [41685757723](https://github.com/SnatchPlay/therapy-scheduling/actions/runs/41685757723) |
| AC-CARD-08 | `own_client_ids()`: «Held» без перевірки терміну (`confirmed_at is null` замість `hold_status = 'Held'`), прострочене утримання знову робить клієнта своїм | `tests/db/client-card-db.test.ts`: AC-CARD-08 і AC-CARD-09; `tests/db/schedule-db.test.ts`: AC-HOLD-21 | [41686167104](https://github.com/SnatchPlay/therapy-scheduling/actions/runs/41686167104) |
| AC-CARD-11 | `requireRole` у `src/lib/supabase/viewer.ts` пускає користувача без ролі | `src/lib/supabase/viewer.test.ts`: AC-CARD-11 | [41686479511](https://github.com/SnatchPlay/therapy-scheduling/actions/runs/41686479511) |

Мутація AC-CARD-08 змінює застосований файл міграції, тому в тому прогоні `db-check` теж червоний (крок «Migration order vs base branch»: `CHANGED … застосовані міграції не редагуємо`); доказом AC-CARD-08 є червоні тести кроку `npm test`.
