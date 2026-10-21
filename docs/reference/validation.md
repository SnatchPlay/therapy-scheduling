# Правила перевірки змін

Як у цьому репо доводимо зміну до коміту й до PR. Скіл `self-review` (`.claude/skills/self-review/`) читає
цей файл першим; де вони розходяться, діє цей файл.

## Gate (кожен коміт)

| Команда | Що доводить |
|---|---|
| `npm run lint` | ESLint, 0 попереджень |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Vitest: unit-тести, тести скриптів і — щойно зріз їх додає — тести бази на PGlite з усіма міграціями (`tests/db/`) |
| `npm run build` | застосунок збирається; у виводі є `ƒ Proxy (Middleware)` |
| `npm run spec:validate`, `npm run spec:check` | OpenSpec strict; denylist і формат специфікації |
| `npm run ac:coverage` | AC → сценарій → тест → рядок матриці |
| `node scripts/check-migration-order.mjs` | нова міграція новіша за `origin/main`; застосовані файли не змінено |

Зміну бази перевіряємо на PGlite (`tests/db/supabase-pglite.ts`, з'являється з першим зрізом, що додає
таблиці), а не застосуванням до хмарного проєкту: хмарна база змінюється лише через `db-deploy` після merge.

## Області рев'ю (self-review: сліпо, з розподілом, коли зміна велика)

| Область | Файли | Чеклісти |
|---|---|---|
| База й доступ | `supabase/**`, `tests/db/**` | self-review *Database & migrations*, *Auth & access*, *Tests*; скіл `rls-migration` |
| Код застосунку й UI | `src/**`, `tests/**` поза `tests/db` | self-review *Auth & access*, *Data access & API contract*, *UI*, *Tests* |
| Специфікація | `openspec/**`, `docs/conformance.md`, `docs/spec-reading.md` | скіл `spec-review` |
| CI й інструменти | `.github/**`, `scripts/**`, `.claude/**`, `.quality-trial/**` | self-review *CI & workflows*, *Scripts & data fixes* |

Зміна UI також потребує скіла `visual-verify`: кожна роль, відвідувач без входу, заборонена сторінка за
прямим посиланням, стани завантаження / порожній / помилка.

## Quality trial (на кожен крок, до його локального коміту)

Це не ворота: ми вимірюємо, який інструмент що ловить. Кожну знахідку перевіряємо кодом, перш ніж їй вірити.

1. `.quality-trial/run.sh --snapshot`, далі рецензенти, далі `.quality-trial/run.sh`: правила ast-grep на
   змінених файлах, `fallow audit` проти `origin/main` (лише нові знахідки), видалені тести, покриття AC,
   тригер deploy readiness, файли, які змінюють інші відкриті PR, файли, записані після знімка.
2. Якщо скрипт пише `REQUIRED` — відповісти на `.quality-trial/deploy-readiness.md` виводом команд.
3. Сліпі рев'ю: список файлів кроку (зокрема невідстежувані), ніколи не намір; обидва читають
   `.quality-trial/known-debt.md`. Понад ~150 змінених рядків — рецензент коректності (області self-review)
   і окремий рецензент принципів (`.quality-trial/principles-review.md`); менше — один рецензент з обома.
4. Мутаційне тестування зміненого TypeScript, що має unit-тести:
   `.quality-trial/stryker.sh --since <база кроку> <файли>`. Кожен Survived / NoCoverage / Timeout мутант розібрати.
   Прогін, де вбито 0, — недостовірний: перевірити один мутант вручну (внести його й запустити тест).
   Для правил SQL — ручна мутаційна перевірка, записана в PR (скіл `rls-migration`).
5. Записувати під час розбору: `.quality-trial/findings-log.md`, `analysis/findings-classified.csv`,
   `analysis/runs.csv` (зокрема прогони без знахідок). `python3 -I .quality-trial/analysis/analyze.py`
   друкує таблиці за інструментами.

## Перед PR гілки (раз на гілку)

1. Ще раз `.quality-trial/run.sh` (інші відкриті PR змінюються).
2. Архітектурне рев'ю: один свіжий сліпий субагент зі списком файлів гілки й
   `.quality-trial/architecture-review.md`.
3. `ponytail-review` (лише читання).
4. Після відкриття PR — `@coderabbitai review` окремим коментарем; на кожен коментар — виправлення або
   аргумент до злиття.

## Нове правило ast-grep

Лише після того, як воно спрацювало на реальній минулій знахідці: заголовок правила називає цю знахідку, а
саме правило перевірено на коді до й після виправлення.
