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
- Обов'язкові перевірки в `solo-main`: з 2026-11-03 до `spec`, `app`, `conformance`, `db-check` додано «Ворота: fallow audit» і «Покриття: доменна підлога» (після зелених прогонів `quality` на `main`: 12a33a7 і 9d176ca). «Порада: вразливі залежності» — ніколи; `E2E: Playwright` теж ні (залежить від живих даних прода, див. розділ C)

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
Задеплоєний код на момент прогону — коміт `12a33a7` (`/api/health`). Відео й траси лежать лише в `test-results/` на машині прогону: не в git і не в CI.

| AC | Перевірки Playwright | Агент-рецензент | Підсумок | Що показує екран |
|---|---|---|---|---|
| AC-CARD-05 | пройшли | Haiku: PASS | **PASS** | therapist1 бачить «You don't have access to this client.» на картці клієнта, що є лише в therapist2; даних клієнта немає, картка не змінилась |
| AC-CARD-16 | пройшли | Haiku: PASS | **PASS** | scheduler1 бачить «This client card doesn't exist.», therapist1 — «You don't have access to this client.», даних клієнтів немає |
| AC-HOLD-44 | пройшли | Haiku: PASS | **PASS** | therapist1 бачить «Only schedulers and admins can view this page.» на `/holds` і на `/slots` therapist2, без утримань, імен і email |

Підсумок рахує код (`scripts/uat/combine.mjs`), а не агент: упала перевірка — завжди FAIL; PASS лише коли збіглися перевірки, вердикт агента і його цитати зі сторінки. Останній прогін: 22:25 за Києвом на чистому дереві (коміт тестів `ba3f604`), розбір агентом коштував $0.0068.

### Як ми дійшли до зеленого прогону

| Прогін | Результат | Причина і виправлення |
|---|---|---|
| 1 | AC-HOLD-44 — FAIL; AC-CARD-05 — NEEDS-HUMAN | FAIL: помилка в нашому тесті. Локатор шукав `Therapist Two` за підрядком і на проді знаходив два пункти («Therapist Two» і «PM Therapist Two»); тепер точний збіг. NEEDS-HUMAN: на проді не було клієнта, що є «своїм» лише для therapist2, тож тест поміняв ролі місцями (відкривав therapist2), а агент слушно відзначив розбіжність із AC |
| 2 | усі три — PASS | Створено тестові дані (див. нижче); сценарій AC-CARD-05 іде дослівно |
| 3 | усі три — PASS | Після self-review: тест тепер перевіряє, що картку відкрив саме очікуваний терапевт (шапка `viewer`), що до порівняння є хоч одне утримання, і падає одразу з текстом при невірному паролі |
| 4 | усі три — PASS | Після рев'ю CodeRabbit: PASS потребує, щоб вердикт був про той самий AC і щоб агент підтвердив усі видимі частини «Тоді» (правила R2 і R4); кожній очікуваній частині має відповідати окремий запис агента (дубль однієї частини не покриває іншу); звіт знято на чистому дереві, тож «Код тестів» — справжній коміт |

### Негативні контролі

`npm run uat:nc` (лише читання, `tests/e2e/negative-controls.spec.ts`): два сценарії з навмисною вадою, щоб показати, що UAT уміє не пройти.

| Контроль | Що навмисно хибне | Перевірки | Агент | Підсумок |
|---|---|---|---|---|
| NC-1 (AC-CARD-16) | у тесті інший очікуваний текст повідомлення | впали | Haiku: PASS (агент помилився) | **FAIL**, R1: впала перевірка, агент її не перекриває |
| NC-2 (AC-CARD-16) | текст «Тоді» у вимозі уточнено, тест і застосунок — ні | пройшли | Haiku: NEEDS-HUMAN, Sonnet: FAIL | **NEEDS-HUMAN**, R3: розбіжність іде до людини |

Перший прогін негативних контролів (22:45) не рахується: тоді не пройшов вхід `therapist`, обидва сценарії не виконались. Другий прогін — у таблиці вище.

### Що записано на прод

UAT-тести лише читають. Один запис створено вручну (скриптом через звичайний інтерфейс від імені `scheduler1`), щоб виконалась передумова AC-CARD-05:

- картка клієнта «UAT AC-CARD-05 Client», `uat-ac-card-05@example.test` (дорослий, англійська мова);
- утримання слота `Therapist Two` на 2026-11-04 09:00–10:00, діє до 2026-11-04 11:41 (усі часи в застосунку — час практики, Лос-Анджелес).

Картку видалити нема чим: у застосунку немає видалення клієнтів. Клієнт перестає бути «своїм» для therapist2 з початку слота, 2026-11-04 09:00 за часом практики (19:00 за Києвом): це раніше за 11:41. Після цього AC-CARD-05 без нових даних знову стане NEEDS-HUMAN (запасна гілка тесту з ролями навпаки).

Щоб прод-UAT (`npm run uat`) не залежав від терміну, потрібні два ручні записи на проді, кожен — за окремим дозволом власника; **на час написання не зроблені**:

1. У `/holds` від імені `scheduler1` натиснути `Confirm` на утриманні клієнта «UAT AC-CARD-05 Client» **до 2026-11-04 09:00 за часом практики (19:00 за Києвом)**: після початку слота підтвердження відмовляє (AC-HOLD-22). Підтверджений сеанс не спливає, тож клієнт лишається «своїм» для therapist2 назавжди (AC-CARD-14).
2. Підтверджене утримання зникає зі списку `/holds` (AC-HOLD-38), а AC-HOLD-44 потребує там хоча б одного утримання. Тому створити ще одне утримання (`Hold`) в будь-якому слоті `Therapist Two` ближче до кінця грудня 2026 (наприклад, 2026-12-29) і не підтверджувати: за 24 години воно стане «Expired» і лишатиметься в списку, доки слот не почнеться, а слот знову вільний.

Тестові записи: лише `*@example.test`. Видалення не передбачено. Після цих двох кроків прод-UAT тримається до 2026-12-29 (далі слотів у базі немає: початкові слоти закінчуються 2026-12-31).

### E2E у CI

[.github/workflows/e2e.yml](../../.github/workflows/e2e.yml): збирає код PR, піднімає **одноразову локальну базу Supabase в раннері** (`npx supabase start`, міграції цього PR), створює акаунти `*@example.test` з випадковим паролем прогону й виконує [tests/e2e/fixtures/e2e-data.sql](../../tests/e2e/fixtures/e2e-data.sql). Після цього ті самі три спеки йдуть на localhost. У прод job нічого не пише й не читає; секрет `DEMO_USER_PASSWORD` і змінні `NEXT_PUBLIC_SUPABASE_*` репозиторію йому більше не потрібні. Без перевірки агента: вона й звіт для PM — лише `npm run uat`. Завдяки цьому `ac:coverage` рахує `tests/e2e/**/*.spec.ts` як покриття AC.

Фікстура створює клієнта «UAT AC-CARD-05 Client» й одне утримання «Held» у слоті Therapist Two на +2 доби від `now()`. Цього досить для двох передумов: клієнт «свій» лише для therapist2 (AC-CARD-05) і у списку `/holds` є рядок (AC-HOLD-44; підтверджені сеанси там не показують). Слот береться з міграційних або створюється, якщо на цей час його немає, тож фікстура не залежить від того, що слоти в міграціях закінчуються 2026-12-31. Утримання діє 24 години: файл — для бази, створеної під прогін; на тривалій локальній базі спершу `supabase db reset`.

Що перевірено:

- `tests/db/e2e-fixture-db.test.ts` (PGlite, входить у `npm test`, 3 тести): клієнт видимий therapist2 і невидимий therapist1; у `hold_list` одне «Held» утримання Therapist Two; повторний запуск нічого не дублює. Мутації фікстури: усі `therapist2` → `therapist1` — падають 2 тести з 3; без `insert into public.holds` — усі 3; без раннього `return` (захист від повтору) — 1.
- Локально на свіжій базі (кроки workflow, база на інших портах, застосунок `next start` на порту 3100 через `UAT_BASE_URL`, бо порт 3000 був зайнятий): 6 тестів (3 входи й 3 AC) пройшли; фікстуру застосовано вдруге без змін у даних, повторний прогін — знову 6 з 6. `supabase db query --local -f` на SQL із помилкою повертає код 1, тож збій фікстури зупинить крок.
- Не перевірено: сам job на GitHub ще не запускався (там `npx supabase start` на раннері й запуск сервера самим Playwright на порту 3000); код виходу `supabase db query`, коли SQL падає; чи вкладається прогін у 15 хвилин разом зі звантаженням образів.

Прод-UAT від цього не залежить: `npm run uat` читає живі дані прода, і його передумови — два ручні записи вище. Job поки не додаємо в обов'язкові перевірки `solo-main`: фільтр `paths` у `e2e.yml` не запускає його на PR без цих шляхів (наприклад, лише `docs/**`), і обов'язкова перевірка висіла б «Expected — waiting». Щоб додати його, спершу треба прибрати `paths` або мати заглушку з тією самою назвою.

### Не зроблено в цьому кроці

- Негативні контролі (`npm run uat:nc`) не запускали.
- Фільтр `ac:coverage` для e2e покритий тестами скрипта (`e2e-counted`, `e2e-not-run`); сам job `e2e` на GitHub — ще ні (див. «E2E у CI»).
- Відкриті знахідки self-review (файли з матеріалів курсу, Low): список — у `.quality-trial/findings-log.md`, запис «WS8 C».

## D. Eval рецензентів

- PR з вадами (не злитий, закривається після eval): [#63](https://github.com/SnatchPlay/therapy-scheduling/pull/63), гілка `task/holds-header-cleanup`, нейтральні назви й опис, 3 вади + 1 приманка. CI на ній зелений, прод-базу вади не чіпають (міграція не застосовується до злиття, функція не викликається).
- Ключ і таблиця з цитатами: [коментар у PR 63](https://github.com/SnatchPlay/therapy-scheduling/pull/63#issuecomment-6615866191). Ключ лежав поза репо, доки обидва рецензенти не відпрацювали.
- Правило: [PR 64](https://github.com/SnatchPlay/therapy-scheduling/pull/64), коміт `c66a17c` — абзац «Рев'ю (серйозність)» в `AGENTS.md`.
- Повторний прогін: [коментар у PR 63](https://github.com/SnatchPlay/therapy-scheduling/pull/63#issuecomment-6616033756).

| Вада | CodeRabbit | `/code-review high` |
|---|---|---|
| роль з `user_metadata` (`viewer.ts:36`) | знайшов, але **Minor** і «база не віддасть дані» | знайшов, **HIGH** |
| `security definer` без `search_path` (міграція) | знайшов частково, Minor (лише `search_path`) | знайшов, MEDIUM (+ без перевірки ролі, рахує Expired, функція не використана) |
| тест AC-HOLD-44 послаблено | знайшов, Trivial | знайшов, MEDIUM |
| приманка `isStaff` | не згадав (хибної тривоги немає) | Low: часткове перенесення (слушне, не про безпеку) |

Рецензентів запущено так: CodeRabbit — `@coderabbitai review`, перший запит впав у ліміт безкоштовних рев'ю, повторний дав рев'ю за 10 хвилин; `/code-review high` — окремим агентом, який не бачив ні ключа, ні коментарів CodeRabbit.

**Правило й повторний прогін.** Слабка ланка — CodeRabbit (вада №1 як Minor). Правило загострює її: роль не з `profiles.role` — «must fix / Critical», RLS її не пом'якшує. Повторний `@coderabbitai full review` о 23:34 відхилено лімітом («next included review will be available in 43 minutes», [коментар](https://github.com/SnatchPlay/therapy-scheduling/pull/63#issuecomment-6615979832)): **ефект правила на CodeRabbit не виміряно**. `/code-review` повторно знайшов усе, роль із `user_metadata` — HIGH і до правила, і після. Повторний прогін CodeRabbit буде зроблено після скидання ліміту окремим коментарем у PR 63.


---

# QA proof pack: зріз 3 (WS9, статус перевірки страхування)

- Вимоги: https://github.com/HryhoriiHaponiukQuitCode/therapy-scheduling-spec · джерело: issues · знімок 2026-11-08 (вимога HryhoriiHaponiukQuitCode/therapy-scheduling-spec#33; вимогу #34 PM переніс на пізніший зріз)
- PR (стек): специфікація #68 → база #69 → застосунок #70 → UAT цей PR. ADR: `docs/decisions/0005-insurance-status-column-update.md`.
- Статус доведення на момент запису: **автоматичні рівні зелені, прод-UAT ще не виконано** (див. «Не зроблено»).

## 6 AC: де живе правило і чим доведено

| AC | Де живе правило | Рівень | Тест |
|---|---|---|---|
| AC-INS-01 | SQL: `insurance_status … default 'Not set'`; текст — `ClientCard` | база (PGlite) + сторінка (Vitest) + e2e | `tests/db/insurance-status-db.test.ts`, `src/app/clients/[id]/page.test.tsx`, `tests/e2e/insurance-status.spec.ts` |
| AC-INS-02 | SQL: `grant update (insurance_status)`, політика `clients_update_insurance_staff` (`with check`: «Not set» не повернути); дія `setInsuranceStatus`, повідомлення | база + дія + сторінка + e2e | ті самі + `src/app/clients/actions.test.ts` |
| AC-INS-03 | та сама політика (`admin` і `scheduler`); картку бачать усі, кому RLS її віддає | база + сторінки + e2e | ті самі + `src/app/clients/page.test.tsx` |
| AC-INS-04 | SQL: `own_client_ids()` для читання; форму рендеримо лише для `STAFF` | база + сторінка + e2e | ті самі |
| AC-INS-05 | SQL: у терапевта немає політики `update` (нуль рядків); дія вважає збереженням один зачеплений рядок | база + дія + e2e (прямий запит до Data API з сесією терапевта) | ті самі |
| AC-INS-06 | `src/proxy.ts` (без входу — `/login`) і права `anon` | проксі (Vitest) + база + e2e | `src/lib/supabase/proxy.test.ts`, `tests/db/insurance-status-db.test.ts`, e2e |

## Доказ мутацією

- SQL (`node scripts/mutation-check.mjs --only I1,…,I8`): **8 з 8 вбито** — політика без обмеження ролі (AC-INS-05), `with check (true)` (AC-INS-02), `grant update` на всю таблицю, немає `grant update (insurance_status)`, немає `check` на значення, початковий статус не «Not set» (AC-INS-01), `grant insert (insurance_status)`, повнота картки знову на update (AC-INS-02, стара картка).
- TypeScript (`--only T4,…,T12`): **9 з 9 вбито** — нуль рядків як «saved», update без обмеження карткою, інше повідомлення, немає guard для користувача без ролі, redirect без кодування id, форма в терапевта, «Not set» у списку, успіх показано помилкою, немає рядка статусу в картці.
- Stryker для `src/lib/messages.ts` (змінені рядки): 5 з 5 вбито. Для `src/app/clients/actions.ts` Stryker не запускається: його службовий виклик на початку тіла функції ламає правило `check:actions` у пісочниці (початковий прогін червоний), тому дію покривають точкові мутанти T4–T8.

## Локальний прогін e2e на одноразовій базі (не прод)

Одноразовий Supabase (`supabase start` на інших портах), збірка коду гілки, `next start`, Playwright (`UAT_BASE_URL=http://localhost:3100`): акаунти з `scripts/create-demo-users.mjs`, пароль випадковий, у репо його немає.

- Увесь набір `npx playwright test --project=chromium`: **14 з 14** (5 входів, AC-CARD-05, AC-CARD-16, AC-INS-01…06, AC-HOLD-44).
- Негативний контроль: політику `clients_update_insurance_staff` на живій базі послаблено до `using (true)` — `AC-INS-05` став червоним (прямий запит терапевта змінив рядок); після повернення політики — знову зелений.
- Візуально (знімки в `docs/img/ws9-insurance-*.png`): картка з рядком «Insurance: …» і форма в планувальника, лише рядок у терапевта, повідомлення «Insurance status saved.»; світла й темна теми, 1280 і 375 px, довге ім'я клієнта переноситься, горизонтального переповнення немає (перевірено `scrollWidth`).

## Що записано на базу цим прогоном

Лише на одноразовій локальній базі, яку зупинено й видалено (`supabase stop --no-backup`). На прод нічого не записано.

## Не зроблено

- **UAT на проді з вердиктом агента-рецензента** (`npm run uat -- --url <прод>`, `uat:review`): прод оновиться лише після злиття PR #68–#70, а сесія розробки не має входу в прод. Сценарій пише дані (`@writes`): кожен прогін лишає на проді одну синтетичну картку `UAT Insurance <запуск>` (*@example.test) і утримання слоту therapist1 — їх слід назвати у звіті UAT. Акаунти `admin` і `scheduler2` мають бути в `accounts.zip`.
- Перевірка на проді запитом лише для читання, що немає карток з email без крапки після «@» (`clients_email_check` лишається `not valid`).
- `db-check` і `db-deploy` на GitHub.
