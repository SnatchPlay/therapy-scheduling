# Зріз 2 на проді: що бачить кожна роль (знімки й спостереження)

Дата: 2026-10-26 · прод: https://therapy-scheduling-weld.vercel.app · акаунти `pm-*@example.test` (`supabase/pm-users.json`).
Знімки зроблено Playwright; паролі вводила людина у видимому вікні, файли сесій після знімків видалено. Дані синтетичні.

**Створено на проді для знімків** (з дозволу власника): картки «Shot Adult», «Shot Child» (опікун «Shot Guardian»), «Shot Other»;
утримання 2026-10-29 о 10:00 у PM Therapist One за Shot Adult («Held»), об 11:00 за Shot Child (підтверджено), о 10:00 у
PM Therapist Two за Shot Other («Held»). Email цих карток відрізняються від email у кроках PM (`docs/pm-acceptance.md`).

## Спостереження (скрипт читав текст сторінки; результат — те, що було на екрані)

| Роль | Дія | Результат | AC |
|---|---|---|---|
| pm-scheduler | New client → Child з порожнім email опікуна | «Enter the guardian's name and a valid email.»; тип «Child», ім'я, дата, мова й ім'я опікуна лишились у формі, поля опікуна позначено | AC-CARD-03 |
| pm-scheduler | створити Adult, Child, Adult | «Client created.» тричі | AC-CARD-01, 02 |
| pm-scheduler | **Slots**, вибір клієнта | «Shot Child (guardian: shot-guardian@example.test)», «Shot Adult (shot-adult@example.test)» | AC-CARD-02 |
| pm-scheduler | **Holds** до й після підтвердження Shot Child | після підтвердження у списку лишились лише два «Held» (підтверджений зник) | AC-HOLD-38 |
| pm-therapist | **Clients** | Shot Adult і Shot Child (з даними опікуна), Shot Other немає, кнопки «New client» немає | AC-CARD-04 |
| pm-therapist | `/clients/<id Shot Other>` | «You don't have access to this client.», жодних даних клієнта | AC-CARD-05 |
| pm-therapist | `/clients/new`, заповнити, Create client; а також порожня форма | «Only schedulers and admins can create client cards.», дані лишились у формі | AC-CARD-06 |
| pm-therapist | **Schedule**, тиждень 2026-10-26 | Held-слот із ім'ям клієнта, жодного email клієнта | AC-HOLD-40 |
| pm-admin | **Clients**, чужа картка | усі три картки, у Shot Child дані опікуна; неіснуюча картка — 404 | AC-CARD-10 |
| без входу | `/clients`, `/clients/<id>`, `/holds`, `/clients/new` | усі чотири адреси ведуть на `/login`, даних клієнтів немає | AC-CARD-07 |
| pm-noaccess | `/`, `/clients`, `/clients/<id>`, `/holds`, `/slots`, `/clients/new` | усі шість дають лише «Your account has no access yet. Contact an administrator.» | AC-CARD-11 |

## Знімки

Світла й темна теми; назви — `docs/img/ws7-s2-<роль>-<сторінка>-<тема>.png`.

| Роль | Сторінка | Файли |
|---|---|---|
| scheduler | порожня форма картки | `ws7-s2-scheduler-new-client-form-light.png`, `…-dark.png` |
| scheduler | відмова AC-CARD-03, дані лишились | `ws7-s2-scheduler-card-guardian-error-light.png` |
| scheduler | список карток | `ws7-s2-scheduler-clients-list-light.png`, `…-dark.png` |
| scheduler | вибір клієнта на Slots | `ws7-s2-scheduler-slots-picker-light.png` |
| scheduler | утримання до й після підтвердження | `ws7-s2-scheduler-holds-before-confirm-light.png`, `…after-confirm-light.png`, `ws7-s2-scheduler-holds-dark.png` |
| therapist | свої клієнти | `ws7-s2-therapist-clients-own-light.png`, `…-dark.png` |
| therapist | картка свого клієнта | `ws7-s2-therapist-client-card-light.png` |
| therapist | чужа картка — відмова | `ws7-s2-therapist-client-denied-light.png`, `…-dark.png` |
| therapist | спроба створити картку | `ws7-s2-therapist-create-forbidden-light.png` |
| therapist | розклад | `ws7-s2-therapist-schedule-light.png`, `…-dark.png` |
| admin | усі картки | `ws7-s2-admin-clients-all-light.png` |
| без ролі | головна | `ws7-s2-noaccess-home-light.png`, `…-dark.png` |
| без входу | сторінка входу | `ws7-s2-anon-login-light.png` |

Не знято: стани завантаження (сторінки віддаються сервером без окремого стану), мобільна ширина.
