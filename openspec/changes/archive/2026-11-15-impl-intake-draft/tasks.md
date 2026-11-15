# Tasks

## 21. Набір, ADR і golden cases (PR `task/intake-draft-logic`, разом із задачею 22)

- [x] 21.1 ADR 0006 «AI-функція: AI SDK + OpenRouter, безкоштовні моделі» (провайдер замінено ADR 0008: Claude API) і залежності `ai`, `zod`, `server-only` (точні версії, Р-контекст)
- [x] 21.2 `src/lib/ai/` (`schema.ts`, `prompts/draft.ts`, `draft.ts`, `models.ts`, `anthropic.ts` (раніше `openrouter.ts`) з `server-only`), `.env.example` (Р32, Р34); `vitest.eval.config.mts` і скрипт `eval` — у 24.2 разом із живим прогоном
- [x] 21.3 Golden cases PM → `tests/fixtures/golden/cases.json` (GC-01…10, `expected` — точні поля й повідомлення з таблиці PM), `tests/ai-key.test.ts`

Done when: `npm test` зелений на наборі без AC-тестів функції; AC-INTAKE-… ще не «реалізовано»

## 22. Логіка чернетки й тести правил (PR `task/intake-draft-logic`, разом із задачею 21)

- [x] 22.1 `askModel` (модель — параметром) + постобробка `buildOutcome`: дата, тип за віком, email, мова, «Missing: …», «сьогодні» в `America/Los_Angeles` (Р32); повідомлення в `MESSAGES` (Р29)
- [x] 22.2 Тести правил і збоїв з AC ID: дата в майбутньому, 429 (також у тілі з HTTP 200), таймаут, не за схемою, немає ключа (Р33, Р35)
- [x] 22.3 `tests/golden.test.ts`: 10 кейсів реплеєм записаних відповідей, назви з AC ID (Р35) — виконано в 24.2 разом із записами: без справжніх записів тест не може бути зеленим, а заглушки не доказ

Done when: AC-INTAKE-05 (unit); AC-INTAKE-08 (unit)

## 23. Дія й панель у формі нової картки (PR `task/intake-draft-ui`)

- [x] 23.1 Server Action `requestIntakeDraft` (`getViewer()` першим, роль перед моделлю, без запису в базу) (Р30, Р31)
- [x] 23.2 Компонент `Textarea` (написано за зразком `Input` + історія Storybook; `shadcn add` дав би інші класи, які довелося б переписувати); панель «Draft from request» над `ClientCardForm`, `Alert`, перемонтування форми лише для чернетки (Р28)
- [x] 23.3 Тести дії, форми й сторінки (терапевт без панелі й форми, відмова не міняє форму, чернетка не пише в базу); `check:actions`, `check:design`
- [x] 23.4 Візуальна перевірка форми з панеллю: світла тема (кадр UAT з прода), темна 1280 px і світла 375 px — `docs/qa/uat/2026-11-15-intake-draft/frames/`; дубль панелі, знайдений на проді, виправлено (PR 85). Темна тема на вузькому екрані й клавіатурний фокус не перевірялись

Done when: AC-INTAKE-03, AC-INTAKE-08, AC-INTAKE-09 на рівні застосунку

## 24. Живий eval і записи (PR `task/intake-draft-eval`)

- [x] 24.1 ADR 0008 і перехід на Claude API: `@ai-sdk/anthropic@4.0.96`, `src/lib/ai/anthropic.ts`, `ANTHROPIC_API_KEY` у `.env.local`; у Vercel лише Production — робить власник
- [x] 24.2 `vitest.eval.config.mts`, `evals/golden.live.eval.ts`, скрипт `eval`, `tests/golden.test.ts`; `RECORD=1 npm run eval`: справжні записи в `tests/fixtures/golden/recorded.json`; звіт `evals/reports/<дата й час>.md`; кожен FAIL пояснено
- [x] 24.3 Заповнені `docs/conformance.md` для AC-INTAKE-01, 02, 04, 05, 06, 07 (реплей) після зеленого `npm test`
- [x] 24.4 Ліміт 10 чернеток на годину на користувача: міграція `intake_draft_quota`, rpc перед моделлю, тести бази й дії, мутанти I12 і I13 (Р36)

Done when: AC-INTAKE-01, 02, 04, 06, 07 (офлайн-реплей записаних відповідей; частка успіху — у звіті eval)

## 25. Прод, UAT і proof pack (PR `task/intake-draft-uat`)

- [x] 25.1 Сценарій `tests/e2e/intake-draft.spec.ts` (AC-INTAKE-03 і AC-INTAKE-06 мінімум); UAT на проді (`53e90d6`): AC-INTAKE-06 PASS; AC-INTAKE-03 NEEDS-HUMAN (на проді вже є картка «Client Ten», створена до UAT; кількість карток до/після однакова) — звіт і кадри в `docs/qa/uat/2026-11-15-intake-draft/`
- [x] 25.2 `docs/conformance.md` для всіх AC зрізу 4 (усі «реалізовано»); повідомлення «eval готовий» у чаті команди — за власником репо
- [x] 25.3 archive `impl-intake-draft` — після 25.1

Done when: AC-INTAKE-03, AC-INTAKE-06 доведено на проді (UAT-запис і вердикт агента)
