# QA proof pack: зріз 2 (картка клієнта, ролі й доступ)

Шаблон: koldovsky/2026-quitcode-08-quality-hw/materials/templates/proof-pack.template.md. Заповнюється по кроках WS8
(A → B → C → D); посилання — на коміти, PR і прогони, без паролів.

- Прод-URL: https://therapy-scheduling-weld.vercel.app
- Вимоги: https://github.com/Sofiia-pm/therapy-scheduling-spec · джерело: issues · знімок 2026-11-03

## 3 AC

| AC | Вид | «Тоді» (дослівно з вимоги PM) |
|---|---|---|
| AC-CARD-05 | відмова в браузері (чужі дані за прямим посиланням) | therapist1 бачить повідомлення «You don't have access to this client.», жодних даних client9 не показано, і картка client9 не змінилася. |
| AC-CARD-16 | стан інтерфейсу (картки немає; різні тексти для двох ролей) | scheduler1 бачить повідомлення «This client card doesn't exist.», therapist1 — «You don't have access to this client.», і жоден із них не бачить жодних даних клієнтів. |
| AC-HOLD-44 | відмова в браузері (сторінки планувальника) | в обох випадках therapist1 бачить повідомлення «Only schedulers and admins can view this page.», жодних утримань, імен чи email клієнтів не показано, і жодне утримання не змінилося. |

## A. Ворота

- PR воріт: https://github.com/SnatchPlay/therapy-scheduling/pull/60
- Зелений `quality` на `main`: https://github.com/SnatchPlay/therapy-scheduling/actions/runs/41696972047
- Обов'язкові перевірки в `solo-main`: ще не додано (див. нижче)

Розбір першого повного прогону `fallow` на `main` (353ab3f): 4 знахідки мертвого коду, 5 груп дублів, 19 функцій
вище порогу складності. Після конфігу лишаються 0 / 0 / 9; інші групи пояснено нижче. Ворота валять лише нові
знахідки відносно бази PR (`audit.gate: new-only`).

| Група знахідок | Скільки | Справжня / навмисна / хибна | Дія і причина |
|---|---|---|---|
| Невикористані файли `scripts/hooks/*.mjs` | 3 | хибна | `entry: ["scripts/hooks/*.mjs"]`: хуки Claude Code запускає `.claude/settings.json` командою `node …`, а не `import`, fallow цього не бачить |
| Невикористаний експорт `AC_ID_GLOBAL` у `scripts/lib/spec-lib.mjs` | 1 | справжня, але в файлі шаблону курсу (є і в чистому шаблоні) | `ignoreExports` з причиною: правки шаблону переносимо cherry-pick, а не локально |
| Дублі в `src/lib/supabase/database.types.ts` | 3 групи | хибна | `duplicates.ignore`: файл генерує `supabase gen types`, ручних змін немає |
| Дублі між `scripts/check-design-tokens.mjs` і `scripts/check-server-boundary.mjs` | 2 групи (28 рядків) | справжня, але файли взято з матеріалів курсу | `duplicates.ignore` і запис у `.quality-trial/known-debt.md` (CodeRabbit уже відповідали на це в PR 30) |
| Складність у скриптах шаблону й матеріалів курсу: `check-spec`, `create-demo-users`, `check-design-tokens`, `check-server-boundary` | 9 функцій | справжня, не наша | `health.ignore` з причиною; мертвий код і залежності в них fallow перевіряє й далі |
| Складність `src/app/api/health/route.ts` (`GET`) | 1 | справжня, файл курсу без змін | `health.ignore`; гілки класифікації покриті `tests/health.test.ts` (`classifyDbProbe`) |
| Складність `SlotsPage`, `CardFields`, `smoke/timeline.play`, `scripts/check-action-auth.mjs` (5 функцій), `scripts/hooks/payload.mjs` | 9 | справжня, наш код | лишено з поясненням: розбивати працюючі сторінки й перевірки в PR про ворота — окрема зміна з власним рев'ю; запис у `.quality-trial/known-debt.md`; ворота їх не валять (успадковані) |
| Тестові правила лінтера: `vitest/expect-expect` у `src/app/slots/actions.test.ts` | 2 | справжня | виправлено: помічник `messageOnSlots` перейменовано в `expectMessageOnSlots` (правило впізнає `expect*`), поведінка тестів не змінилась |

Підлога покриття (`vitest.coverage.config.mts`, `FLOORED`): `src/lib/{clients,health,messages,slots,time}.ts`, кожен
файл окремо ≥ 90 % рядків, функцій і операторів, ≥ 85 % гілок. Перевірено, що підлога падає: з одним
`src/lib/time.test.ts` кроки «Coverage for … does not meet threshold» дають код помилки.
Файли сторінок і дій (`src/app/**`) і адаптери Supabase без підлоги: їх доводять тести бази (PGlite) та UAT.

## B. Якість тестів

PR: https://github.com/SnatchPlay/therapy-scheduling/pull/61. Усі посилання на тести — на коміті `ce833c1`.

### Рівень для кожного AC

| AC | Де живе правило | Рівень | Чому | Тест |
|---|---|---|---|---|
| AC-CARD-05 | SQL: політика `clients_select_therapist` і `private.own_client_ids()`; текст відмови — `src/app/clients/[id]/page.tsx`, `src/lib/messages.ts`; роль користувача — `src/lib/supabase/viewer.ts` | база (PGlite, `asUser`) + сторінка (Vitest) + `viewer` (unit) + UAT (екран) | правило двічі: SQL — остання межа, без якої сторінка показала б чужу картку; TS — повідомлення PM; мок чи TS-копія SQL-правила не довели б нічого | [client-card-db.test.ts:433](https://github.com/SnatchPlay/therapy-scheduling/blob/ce833c15763167af43c68c3adf5190cc42aeb4ab/tests/db/client-card-db.test.ts#L433), [page.test.tsx:41](https://github.com/SnatchPlay/therapy-scheduling/blob/ce833c15763167af43c68c3adf5190cc42aeb4ab/src/app/clients/%5Bid%5D/page.test.tsx#L41), [viewer.test.ts:53](https://github.com/SnatchPlay/therapy-scheduling/blob/ce833c15763167af43c68c3adf5190cc42aeb4ab/src/lib/supabase/viewer.test.ts#L53) |
| AC-CARD-16 | TS: `STAFF.includes(role)` у `src/app/clients/[id]/page.tsx` (для бази обидва випадки — нуль рядків) | сторінка (Vitest) + UAT (екран) | різницю текстів для двох ролей SQL не знає; точний текст бачить людина | [page.test.tsx:68](https://github.com/SnatchPlay/therapy-scheduling/blob/ce833c15763167af43c68c3adf5190cc42aeb4ab/src/app/clients/%5Bid%5D/page.test.tsx#L68) |
| AC-HOLD-44 | TS: перевірка ролі в `src/app/slots/page.tsx` і `src/app/holds/page.tsx`; SQL: політики `slots_select`, `holds_select` | сторінка (Vitest, «без запитів до бази») + база (PGlite) + UAT (екран) | правило двічі: сторінка не питає базу для терапевта, RLS — остання межа; пряме читання таблиці `holds` доведено окремим тестом після вижилого мутанта H2 | [slots/page.test.tsx:59](https://github.com/SnatchPlay/therapy-scheduling/blob/ce833c15763167af43c68c3adf5190cc42aeb4ab/src/app/slots/page.test.tsx#L59), [holds/page.test.tsx:65](https://github.com/SnatchPlay/therapy-scheduling/blob/ce833c15763167af43c68c3adf5190cc42aeb4ab/src/app/holds/page.test.tsx#L65), [schedule-db.test.ts:122](https://github.com/SnatchPlay/therapy-scheduling/blob/ce833c15763167af43c68c3adf5190cc42aeb4ab/tests/db/schedule-db.test.ts#L122) |

### Покриття

`npm run test:coverage` (v8) на цьому коміті.

| Файл за AC | Рядки | Гілки | Чим доведено, якщо 0 % |
|---|---|---|---|
| `src/lib/supabase/viewer.ts` | 100 % | 100 % | — |
| `src/lib/messages.ts` | 100 % | 100 % | — |
| `src/app/clients/[id]/page.tsx` | 100 % | 100 % | — |
| `src/app/slots/page.tsx` | 100 % | 79,48 % | — (гілки — рядки пошуку клієнта, поза нашими AC) |
| `src/app/holds/page.tsx` | 100 % | 88,88 % | — |

Сторінки мають 100 % рядків, бо їх рендерять тести Vitest із фейковим клієнтом Supabase. Це доводить поведінку сторінки, але не реальну сесію: тексти на екрані й вхід під ролями доводить UAT (частина C). Адаптери `src/lib/supabase/{server,proxy}.ts` (0 % і 60 %) тестами Vitest не доводяться, їх перевіряє UAT.

### Доказ мутацією

| Мутант (файл:рядок, що змінено) | AC під загрозою | До | Тест, посилений з тексту AC | Після |
|---|---|---|---|---|
| `src/lib/supabase/viewer.ts:23-25` `.from("profiles")`, `.select("email, full_name, role")`, `.eq("id", claims.sub)` → порожні рядки | AC-CARD-05 (роль терапевта визначається за профілем користувача з сесії) | вижили (3) | [viewer.test.ts:53](https://github.com/SnatchPlay/therapy-scheduling/blob/ce833c15763167af43c68c3adf5190cc42aeb4ab/src/lib/supabase/viewer.test.ts#L53): таблиця, колонки й фільтр `id = sub` | убиті |
| `src/lib/supabase/viewer.ts:33-34` `profile?.role` → `profile.role`, `profile?.email` → `profile.email`, `??` → `&&` | AC-CARD-11 (користувач без профілю — без ролі, не збій) | вижили (4) | [viewer.test.ts:59](https://github.com/SnatchPlay/therapy-scheduling/blob/ce833c15763167af43c68c3adf5190cc42aeb4ab/src/lib/supabase/viewer.test.ts#L59) і тест email у шапці | убиті |
| `supabase/migrations/20261019143036_slots_and_holds.sql` політика `holds_select`: `true or (…)` (мутант H2) | AC-HOLD-44 (жодних утримань чужих слотів) | вижив | [schedule-db.test.ts:122](https://github.com/SnatchPlay/therapy-scheduling/blob/ce833c15763167af43c68c3adf5190cc42aeb4ab/tests/db/schedule-db.test.ts#L122): `select id from public.holds` як therapist1 | убитий |

- Stryker: `viewer.ts` 78,79 % → 100 % (26 → 33 убито), `messages.ts` 94,19 % (вижилі 5 лише в `clientErrorCode`, AC-CARD-12), весь `src/lib` 93,73 %. Вивід — в описі PR 61.
- SQL-мутації (`npm run mutation:sql`) і точкові TS-мутанти (`npm run mutation:points`): 9 з 9 убито (P1, P2 — перевірка гарнесу; C1, C2 — AC-CARD-05; H1, H2 — AC-HOLD-44; T1 — AC-CARD-16; T2, T3 — AC-HOLD-44). Таблиця «що зламано → який тест упав» — в описі PR 61.
- Еквівалентні мутанти: серед наших AC немає.
- Прогін мутації в CI: червоні кроки `npm test` для відмов того ж класу — `docs/evidence/mutation-card.md`.


## C. UAT на проді

Звіт для PM: [docs/qa/uat/2026-11-03/report.md](uat/2026-11-03/report.md) (кадри «Тоді» — `frames/`, підсумок — `manifest.json`).
Запуск: `npm run uat -- --url https://therapy-scheduling-weld.vercel.app`. Тести — `tests/e2e/*.spec.ts` (Playwright), по одному на AC.
Задеплоєний код на момент прогону — коміт `12a33a7` (`/api/health`). Відео й траси лежать у `test-results/` і не в git.

| AC | Перевірки Playwright | Агент-рецензент | Підсумок | Що показує екран |
|---|---|---|---|---|
| AC-CARD-05 | пройшли | Haiku: PASS | **PASS** | therapist1 бачить «You don't have access to this client.» на картці клієнта, що є лише в therapist2; даних клієнта немає, картка не змінилась |
| AC-CARD-16 | пройшли | Haiku: PASS | **PASS** | scheduler1 бачить «This client card doesn't exist.», therapist1 — «You don't have access to this client.», даних клієнтів немає |
| AC-HOLD-44 | пройшли | Haiku: PASS | **PASS** | therapist1 бачить «Only schedulers and admins can view this page.» на `/holds` і на `/slots` therapist2, без утримань, імен і email |

Підсумок рахує код (`scripts/uat/combine.mjs`), а не агент: упала перевірка — завжди FAIL; PASS лише коли збіглися перевірки, вердикт агента і його цитати зі сторінки. Останній прогін: 21:49 за Києвом, розбір агентом коштував $0.0066.

### Як ми дійшли до зеленого прогону

| Прогін | Результат | Причина і виправлення |
|---|---|---|
| 1 | AC-HOLD-44 — FAIL; AC-CARD-05 — NEEDS-HUMAN | FAIL: помилка в нашому тесті. Локатор шукав `Therapist Two` за підрядком і на проді знаходив два пункти («Therapist Two» і «PM Therapist Two»); тепер точний збіг. NEEDS-HUMAN: на проді не було клієнта, що є «своїм» лише для therapist2, тож тест поміняв ролі місцями (відкривав therapist2), а агент слушно відзначив розбіжність із AC |
| 2 | усі три — PASS | Створено тестові дані (див. нижче); сценарій AC-CARD-05 іде дослівно |
| 3 | усі три — PASS | Після self-review: тест тепер перевіряє, що картку відкрив саме очікуваний терапевт (шапка `viewer`), що до порівняння є хоч одне утримання, і падає одразу з текстом при невірному паролі |

### Що записано на прод

UAT-тести лише читають. Один запис створено вручну (скриптом через звичайний інтерфейс від імені `scheduler1`), щоб виконалась передумова AC-CARD-05:

- картка клієнта «UAT AC-CARD-05 Client», `uat-ac-card-05@example.test` (дорослий, англійська мова);
- утримання слота `Therapist Two` на 2026-11-04 09:00–10:00, діє до 2026-11-04 11:41.

Картку видалити нема чим: у застосунку немає видалення клієнтів. Утримання спливе саме; після цього клієнт перестане бути «своїм» для therapist2, і AC-CARD-05 без нових даних знову стане NEEDS-HUMAN (запасна гілка тесту з ролями навпаки).

### E2E у CI

[.github/workflows/e2e.yml](../../.github/workflows/e2e.yml): збирає код PR і запускає ті самі три спеки на localhost проти нашого проєкту Supabase (змінні `NEXT_PUBLIC_SUPABASE_*` і секрет `DEMO_USER_PASSWORD` у репо задано). Без перевірки агента: вона й звіт для PM — лише `npm run uat`. Завдяки цьому `ac:coverage` рахує `tests/e2e/**/*.spec.ts` як покриття AC.
Той самий шлях, виконаний локально (`CI=true npx playwright test --project=chromium` на збірці з `NEXT_PUBLIC_*`): 6 тестів (3 входи й 3 AC) пройшли. На GitHub workflow ще не запускався. У обов'язкові перевірки `solo-main` його не додано: тест читає живі дані прода, і після спливу тестового утримання job стане червоним без зміни коду. Постійне виправлення — крок сіду таких даних перед тестом, окрема задача.

### Не зроблено в цьому кроці

- Негативні контролі (`npm run uat:nc`) не запускали.
- Фільтр `ac:coverage` для e2e покритий тестами скрипта (`e2e-counted`, `e2e-not-run`); сам job `e2e` на GitHub — ні.
- Відкриті знахідки self-review (файли з матеріалів курсу, Low): список — у `.quality-trial/findings-log.md`, запис «WS8 C».
