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

