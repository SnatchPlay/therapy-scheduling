# Приймання зрізу 2 для PM: акаунти й кроки

Прод: https://therapy-scheduling-weld.vercel.app · вимога: Sofiia-pm/therapy-scheduling-spec#19 (знімок 2026-10-25) ·
статус кожного AC — `docs/conformance.md`. Дані синтетичні (`*@example.test`).

## Акаунти

Створює `npm run users:pm` (список — `supabase/pm-users.json`). Пароль — один на всі п'ять, надсилається лише в чаті, не в репо.

| Логін | Роль | Для чого |
|---|---|---|
| `pm-admin@example.test` | admin | усе, що планувальник; бачить усі картки |
| `pm-scheduler@example.test` | scheduler | створює картки, утримує слоти, підтверджує |
| `pm-therapist@example.test` | therapist | «PM Therapist One»: слоти з 2026-10-26, свої клієнти |
| `pm-therapist2@example.test` | therapist | «PM Therapist Two»: другий терапевт, для чужих карток |
| `pm-noaccess@example.test` | без ролі | бачить лише повідомлення про відсутність доступу |

У списку терапевтів на **Slots** є й `Therapist One`, і `Therapist Two` (демо-акаунти зрізу 1): для приймання обирайте
**PM Therapist One** і **PM Therapist Two**, а день — будній, не раніше ніж за 2 доби (слоти — 09:00–16:00 за часом практики).
Кроки одноразові: email клієнта унікальний, картки не редагуються й не видаляються, тож повторний прогін дасть
«A client with this email already exists.»; для повторного прогону беріть інші email.

## Підготовка (під `pm-scheduler`)

1. **Clients → New client** → Adult «Client Six», `client6@example.test`, 1990-05-14, English.
2. Child «Client Seven», 2015-03-02, Spanish, опікун «Guardian Seven», `guardian7@example.test`.
3. Adult «Client Nine», `client9@example.test`, 1988-08-08, English.
4. **Slots**: утримати слот PM Therapist One за client6 («Held»); утримати інший слот PM Therapist One за client7 і на **Holds**
   підтвердити («Confirm»); утримати слот PM Therapist Two за client9.

Крок AC-CARD-09 робіть до п. 4 (або через 24 години, коли всі утримання PM Therapist Two прострочаться): інакше PM Therapist Two
уже має «Held».

## Кроки (AC → що зробити → що має бути)

| AC | Кроки | Очікування |
|---|---|---|
| AC-CARD-01 | після п. 1 підготовки | картку створено, усі дані видно; client6 є у виборі клієнта на **Slots** |
| AC-CARD-02 | після п. 2 | у виборі клієнта на **Slots** біля Client Seven — `guardian: guardian7@example.test` |
| AC-CARD-03 | New client, тип Child, ім'я «Client Eight», 2016-01-10, English, без імені чи email опікуна | «Enter the guardian's name and a valid email.», введені дані лишаються у формі |
| AC-CARD-04 | після п. 4: `pm-therapist` → **Clients** | картки client6 і client7 з усіма даними (client7 — з даними опікуна), client9 немає |
| AC-CARD-05 | `pm-therapist`: відкрити `/clients/<id client9>` (id — з посилання картки під `pm-scheduler`) | «You don't have access to this client.», жодних даних |
| AC-CARD-06 | `pm-therapist`: відкрити `/clients/new`, заповнити (або лишити порожнім), Create client | «Only schedulers and admins can create client cards.», кількість карток не змінилась |
| AC-CARD-07 | без входу відкрити `/clients`, `/clients/<id>`, `/holds` | лише сторінка входу |
| AC-CARD-08 | утримання client6 у PM Therapist One через 24 години після створення «Expired»; `pm-therapist` → **Clients** і пряме посилання на client6 | client6 немає, за посиланням відмова без даних (чекати добу) |
| AC-CARD-09 | `pm-therapist2` до п. 4 → **Clients** | «No clients yet. Clients appear here when a scheduler holds a slot with you.» |
| AC-CARD-10 | `pm-admin` і `pm-scheduler` → **Clients** | усі картки (client6, 7, 9), у client7 — дані опікуна |
| AC-CARD-11 | `pm-noaccess` відкриває застосунок і `/clients/<id>` | лише «Your account has no access yet. Contact an administrator.» |
| AC-HOLD-39 | `pm-scheduler`, New client: Adult, дата 1990-01-01, English; email `client3@example`, `client3@@example.test`, `@example.test`, `client 3@example.test` (по одному) | у кожному випадку «Enter the client's name and a valid email.», картку не створено |
| AC-HOLD-41 | те саме, але ім'я «   » (самі пробіли), `client5@example.test`; потім ім'я « Client Four », `client4@example.test` | перше — «Enter the client's name and a valid email.»; друге створено з іменем «Client Four» |
| AC-HOLD-40 | `pm-therapist` → **Schedule** (тиждень зі слотом PM Therapist One за client6) | ім'я клієнта є, email немає |
| AC-HOLD-38, 42 | під `pm-scheduler` **Holds**: «Held» зі слотом, що почнеться за ≥ 1 годину, є в списку; після початку слоту (оновити сторінку) — немає; підтверджених немає | порядок — за часом слоту від найближчого |
| AC-HOLD-37 | потребує «Expired» (24 години після створення) і повторного утримання тим самим клієнтом | старий запис «Expired» зникає зі списку (через добу) |

Перевірено автоматично (на проді не відтворюється за хвилини): `tests/db/hold-list-db.test.ts` (AC-HOLD-37, 38, 42, 40),
`tests/db/client-card-db.test.ts` (AC-CARD-01…11 і AC-HOLD-39, 41 на рівні бази); мутації — в описах PR #34, #35, #36.
