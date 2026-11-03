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
