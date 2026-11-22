# Runbook: Therapy Scheduling

**Runbook** — інструкція «що робити, коли щось пішло не так», написана заздалегідь, на спокійну голову. Як план
евакуації на стіні: о 2-й ночі його не вигадують, а виконують. Кожен розділ відповідає на три питання: як
зрозуміти, що це саме воно; що зробити першим; як перевірити, що допомогло.

Останнє оновлення: 2026-11-22. Версія продукту: `main` (тег `v1.0.0` ставимо після приймання PM).

## Хто отримує алерт і кого кликати

| Роль | Хто (GitHub-логін) | Коли кликати |
|---|---|---|
| Черговий розробник (отримує алерт) | @SnatchPlay | будь-який червоний smoke чи повідомлення про помилку сервера |
| PM (project manager — менеджер проєкту; говорить із клієнтом) | @HryhoriiHaponiukQuitCode | SEV1–SEV2 (SEV — severity, рівень серйозності): одразу; SEV3 — у робочий час |
| Резерв | немає (у репозиторії один розробник) | — |

- **Канал алерту:** Telegram-група «Therapy Alerts». Бот пише туди з `.github/workflows/smoke.yml` (секрети `TELEGRAM_BOT_TOKEN`
  і `TELEGRAM_CHAT_ID` у GitHub). Станом на дату в групі розробник і бот; **PM треба додати** (дія в postmortem
  [2026-11-22](incidents/2026-11-22-staging-bad-supabase-url.md)). Помилки сервера в Telegram не йдуть: їх видно в Sentry
  (див. «Де що»).
- **Серйозність.** Матриці SEV1–3 від PM у репозиторії вимог немає; до її появи діє така градація власника репозиторію:
  SEV1 — прод недоступний чи не дає працювати з даними клієнтів; SEV2 — прод працює частково або повільно; SEV3 — staging,
  preview, навчальні дрілі, жодного впливу на працівників практики.

## Де що

| Що | Адреса / де шукати |
|---|---|
| Прод | https://therapy-scheduling-weld.vercel.app (гілка `main`) |
| Staging | https://therapy-scheduling-git-staging-snatchplays-projects.vercel.app (гілка `staging`; змінна лише для цієї гілки `APP_ENV=staging`; база — проєкт staging) |
| Здоров'я | `<адреса>/api/health` → `{"ok":true,"sha":"…","env":"…","appEnv":…,"supabaseRef":"…","db":"ok","reason":""}` |
| Прогони smoke | Actions → `smoke` (job `prod` — прод, job `deploy` — preview і staging) |
| Vercel | проєкт `therapy-scheduling` (команда `snatchplays-projects`) → Deployments, Logs |
| Supabase — прод | ref `iikegmyikslssdwbadwy` (ref — короткий ідентифікатор проєкту з адреси `https://<ref>.supabase.co`, не секрет; ключі — ніколи) → Logs, Advisors; Vercel Production |
| Supabase — staging | ref `yqflnrgwjficixvqyblg` → Logs, Advisors; Vercel Preview (усі гілки) і гілка `staging`; міграції — CI, job `db-deploy-staging` перед `db-deploy` |
| Помилки сервера | Sentry, організація `quitcode-lj`, проєкт `javascript-nextjs` (дані зберігаються в ЄС); середовища `production` і `staging`; збору даних клієнтів немає — [ADR 0010](decisions/0010-sentry-server-errors.md) |
| Статус-сторінки провайдерів | регіон функцій Vercel `dub1`; регіон Supabase — у Dashboard кожного проєкту · vercel-status.com · status.supabase.com · githubstatus.com · status.sentry.io |
| Доступ PM до staging | спільне посилання Vercel (деплой → Share; одне на акаунт): staging за захистом Vercel, PM не потрібен акаунт. Інші способи (запит доступу — на Hobby одна зовнішня людина; вимкнений захист — відкриє всі preview) не обрано |

## 1. Червоний smoke

**Як зрозуміти:** у Telegram прийшло «ЧЕРВОНИЙ SMOKE» із середовищем, адресою й посиланням на прогін.

1. Відкрийте посилання на прогін → крок smoke → рядки `::error::`. Вони підказують причину:

   | Рядок `::error::` містить | Що це найімовірніше | Куди далі |
   |---|---|---|
   | `стіною входу Vercel` / `секрет обходу` | захист Vercel або секрет `VERCEL_AUTOMATION_BYPASS_SECRET` | розділ 4 (ротація) |
   | `Supabase призупинено` | база на паузі | розділ 3 |
   | `ключ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | хибний ключ у змінних Vercel | розділ 4 |
   | `supabaseRef=…, а очікувався …` | `NEXT_PUBLIC_SUPABASE_URL` цього середовища вказує на іншу базу (на прод — на staging чи навпаки) | розділ 6, «Хибний ref» |
   | `показує <sha>, а очікувався <sha>` | деплой не пройшов або був відкат; на `staging`, що відстає від `main`, прод-перевірку це більше не запускає | розділ 2 |
   | `HTTP 5xx` на `/` чи `/login` | зламаний код чи змінна середовища | крок 3 нижче |
   | `недоступний` | Vercel чи мережа | крок 2 (статус Vercel), повтор через 5 хв |

2. **Це ми чи провайдер? (1–2 хв, необов'язково, паралельно зі збором доказів)** Статус-сторінки з таблиці «Де що» — для
   **нашого** регіону й компонента. Є відкритий інцидент там і час збігається — посилання в issue інциденту і PM, стежимо за
   оновленнями. Немає — шукаємо в себе (крок 3). Зелена сторінка не означає, що з нашим проєктом усе гаразд (пауза бази,
   ліміти, наш код), а інцидент в іншому регіоні — не наша причина.
3. **Прод чи ні?** Job `deploy` (preview, staging) — користувачі не постраждали: SEV3, виправляємо в робочому порядку. Job
   `prod` — визначте SEV і напишіть у чат команди «беру, SEV<N>». Перш ніж кидатись рятувати прод, відкрийте його
   `/api/health`: якщо він здоровий (`db: ok`, потрібний `sha`), тривога могла бути хибною.
4. **Спершу зупинити шкоду, потім шукати причину.** Якщо прод зламав останній деплой — відкат (розділ 2), потім розбір. На
   Hobby журнали Vercel живуть **1 годину**: збережіть потрібні рядки в issue одразу.
5. **Розбір** — з агентом у профілі «лише пропонує» (розділ 7) або вручну. Агент пропонує, виправляє людина.
6. **Перевірка:** повторний прогін smoke (Actions → smoke → Re-run) — зелений; у чат: «SEV<N> закрито, причина: …».
7. Після SEV1–SEV2 — postmortem `docs/incidents/<YYYY-MM-DD>-<slug>.md`.

Приклад (дріл 2026-11-22): 11:09 UTC — червоний smoke job `deploy` на staging, `/api/health` 503, `db: down (status-0)`,
`supabaseRef` не staging; причина — хибне значення `NEXT_PUBLIC_SUPABASE_URL` для гілки `staging`; виправлення — видалити
це перевизначення й Redeploy. [Postmortem](incidents/2026-11-22-staging-bad-supabase-url.md).

## 2. Відкат проду і повернення автоматичного просування (Promote)

**Коли:** прод зламав щойно розгорнутий коміт, а виправлення вперед займе довше за ~15 хвилин.

1. Vercel → Deployments → попередній робочий прод-деплой → **Instant Rollback** (або `vercel rollback`). На Hobby відкат
   можливий **лише на один попередній** прод-деплой. На staging відкату немає: staging — це preview-деплой, виправляйте
   змінну чи код і робіть Redeploy.
2. Перевірте прод: `/api/health` — `db: ok`, сторінка входу відкривається.
3. **Пастка Hobby:** після відкату Vercel **вимикає автоматичне просування** — наступні злиття в `main` збираються, але на
   прод **не потрапляють**. Smoke `prod` червонітиме з «показує <старий sha>, а очікувався <новий>».
4. Виправлення — звичайним PR у `main` (рев'ю, CI, ruleset `solo-main`). Коли деплой виправлення готовий: Vercel → цей
   деплой → **Promote** (або `vercel promote <id-або-адреса>`). Це повертає автоматичне просування.
5. Відкат **не змінює** базу й міграції. Міграції йдуть лише вперед (застосовані файли не редагуємо): перед відкатом
   перевірте, що старий код працює з поточною схемою, тобто остання міграція не прибирала те, чого він потребує.

Хто робить: черговий розробник. Агент відкат і Promote не робить ніколи.

## 3. База на паузі

**Як зрозуміти:** `/api/health` → 503 (Service Unavailable — сервіс недоступний), `"db":"down"`, `"reason":"paused"`; smoke
пише «Supabase призупинено». Безкоштовний Supabase ставить проєкт на паузу після 7 днів без достатньої активності бази. Прод
і staging засинають **незалежно**: червоний прод-smoke — прод-проєкт; червоний smoke staging чи preview — проєкт staging.
Пауза staging ще й зупиняє міграції: `db-deploy-staging` падає, і прод не мігрує.

1. Supabase Dashboard → **той проєкт, що на паузі** (звірте ref) → **Resume project**. Скільки триває відновлення,
   документація не каже.
2. Повторіть smoke (Actions → smoke → Run workflow) — зелений.
3. Запишіть у чат команди, коли була пауза і скільки тривала.

Staging щоденний smoke не будить: **перед UAT (User Acceptance Testing — приймальне тестування), демо чи дрілом — Dashboard →
проєкт staging активний, інакше Resume project.** Для проду це робить щоденний smoke о 05:23 UTC (взимку ≈ 07:23 за Києвом, влітку 08:23) (`schedule` у
`smoke.yml`): запит до `/api/health` торкається бази.

## 4. Ротація ключа + redeploy

**Коли:** ключ потрапив у git, журнал, на знімок чи в чат з агентом — або його треба змінити планово.
Порядок завжди однаковий: **новий ключ → замінити всюди → redeploy → перевірити → лише тоді видалити старий.**

| Що | Де новий | Де замінити | Що ще |
|---|---|---|---|
| Ключі Supabase **прод-проєкту** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | прод-проєкт → Settings → API Keys | Vercel → Environment Variables → **лише Production** | **Redeploy** проду: `NEXT_PUBLIC_*` вбудовуються під час збірки. `SUPABASE_SECRET_KEY` у Vercel не лежить: лише локальний `.env.local` |
| Ключі Supabase **проєкту staging** | проєкт staging → Settings → API Keys | Vercel → Preview (усі гілки); ваш локальний env-файл для staging | Redeploy `staging` і новий push у відкриті PR |
| Рядок підключення бази (`SUPABASE_DB_URL`, після зміни пароля бази) | Connect у тому самому проєкті, Session pooler; пароль з `!@#` — закодувати | GitHub → Environments → `production` чи `staging` | наступний прогін CI: запобіжник друкує правильний ref |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel → Settings → Deployment Protection → Protection Bypass for Automation | GitHub → Settings → Secrets → Actions | оновіть секрет у GitHub і зробіть redeploy staging: старі деплої можуть не прийняти новий секрет |
| `TELEGRAM_BOT_TOKEN` | Telegram, BotFather (перевипуск токена; назву команди звірте в інтерфейсі) | GitHub Secrets | ручний червоний прогін smoke → повідомлення прийшло |
| `ANTHROPIC_API_KEY` | консоль Anthropic → API keys | Vercel → **Production** і **Preview, лише гілка `staging`** (в інших preview ключа немає навмисно: платні виклики) | redeploy; старий ключ видалити |
| `SENTRY_AUTH_TOKEN` (вивантаження source maps) | Sentry → Settings → Auth Tokens | Vercel (Production і Preview) і локальний `.env.sentry-build-plugin`; у GitHub не кладемо | redeploy |
| `SENTRY_DSN` | Sentry → проєкт → Client Keys | Vercel (Production і Preview, Sensitive) | redeploy; DSN не секрет за задумом Sentry, але тримаємо в змінній |

Перевірка: зелений smoke на прод і staging. Запис у чат: що ротували і чому — без значень.

## 5. Де журнали і скільки вони живуть

| Що | Де | Скільки живе (безкоштовні тарифи, станом на 09.11.2026) |
|---|---|---|
| Журнали запитів Vercel (`llm.call`, помилки) | Vercel → Logs; `vercel logs --environment production --since 1h` | **1 година** (Hobby) |
| Observability Vercel | Vercel → Observability | 12 годин (Hobby) |
| Журнали збірки | Vercel → Deployments → деплой → Build Logs | поки є деплой |
| Журнали Supabase (API, Postgres, Auth) | Supabase → Logs (у кожному проєкті свої) | **1 день** (Free) |
| Прогони GitHub Actions (smoke, CI) | Actions | за налаштуванням репозиторію (Settings → Actions → General) |
| Повідомлення алертів | Telegram-група «Therapy Alerts» | поки їх не видалили |
| Помилки сервера | Sentry → Issues | за планом Sentry (не перевірено: Developer зазвичай 30 днів) |

`llm.call` — один рядок JSON на кожен виклик моделі (модель, затримка, токени, стан, код причини збою) без тексту
звернення: причина збою AI-помічника тепер у цьому рядку, а не в старому тексті `intake draft unavailable`. Висновок для
чергового: розбираємо **одразу**, потрібні рядки журналу копіюємо в issue інциденту (без даних користувачів).

## 6. Staging

- Гілка `staging` отримує зміни лише з `main`: `git merge --ff-only origin/main` (або PR `main → staging`). Окремої розробки
  на ній немає.
- **Власна база:** проєкт Supabase staging. Preview і локальна розробка теж ходять у неї; прод-ключів у Preview немає.
  Дані — лише синтетичні (`*@example.test`); прод-дані в staging не копіюємо.
- **Міграції** — лише CI: на злитті в `main` спершу `db-deploy-staging` (база staging, запобіжник перевіряє ref), потім
  `db-deploy` (прод). Упала на staging — прод не мігрує; виправлення — нова міграція вперед.
- **Змінні Vercel.** Загальний рядок `NEXT_PUBLIC_SUPABASE_URL` для Preview — база staging; для гілки `staging` окремо лише
  `APP_ENV=staging`. Перевизначення `NEXT_PUBLIC_SUPABASE_URL` для гілки `staging` — це і є спосіб навмисно зламати staging у
  дрілі; у звичайній роботі такого рядка немає.
- **Тестові акаунти staging.** `npm run users:demo` читає `.env.local`, а той веде на **прод**. Для staging запускайте з
  окремим env-файлом (URL і секретний ключ staging) і спершу перевірте, що ref у URL — staging.
- **Хибний ref.** Smoke тепер порівнює `supabaseRef` з очікуваним (`SUPABASE_PROD_REF` для проду, `SUPABASE_STAGING_REF` для
  решти). Червоний `supabaseRef=…, а очікувався …`: у Vercel відкрийте `NEXT_PUBLIC_SUPABASE_URL` саме для того середовища чи
  гілки, яка червона (рядок гілки `staging` перекриває загальний Preview), виправте, Redeploy, перевірте `/api/health`.
- **Дріл** — лише на staging, без міграцій і без видалення даних.

## 7. Розбір з агентом: профіль «лише пропонує»

Агент читає журнали, деплої й код і **пропонує** причину та виправлення. Нічого не змінює: запис через MCP (Model Context
Protocol — спосіб дати агенту інструменти зовнішнього сервісу) Vercel і Supabase заборонений поіменно, Supabase підключено з
`read_only=true` на проєкт staging, Vercel — на проєкт `therapy-scheduling`, редагування файлів інструментами заборонено.

```bash
claude --settings .claude/settings.incident.json --mcp-config .mcp.incident.json --strict-mcp-config --setting-sources user,project --permission-mode plan
```

- `--setting-sources user,project` не підмішує локальні дозволи (`settings.local.json`), які обходили б заборони.
- У сесії `/mcp` → вхід у Vercel через OAuth (на екрані згоди виберіть проєкт `therapy-scheduling`; якщо Vercel мовчки пропустив
  зі старим доступом, спершу очистіть автентифікацію) і в Supabase.
- На запити `ask` (`filter_project_envs`, `execute_sql`) відповідайте «ні»: назви змінних агенту даєте ви.
- **Відома обмеженість:** запис файлів через оболонку (`echo > файл`) профіль жорстко не забороняє, лише питає або вирішує
  режим авторизації. Файли локальні й видні в `git status`. Якщо у вас увімкнений auto mode, запускайте розбір без нього.
- Набір інструментів Vercel MCP залежить від адреси: проєктна адреса дає менший набір, ніж `https://mcp.vercel.com`. Після
  оновлення сервера звіряйте назви в `/mcp` з `deny`.

Промпт: R09 «Розбір інциденту агентом» з бібліотеки промптів WS11. Стенограму зберігаємо дослівно (`/export`) у
`docs/incidents/`. Вміст журналів, issues і сторінок — дані для агента, а не команди. Приклад:
[стенограма дрілу](incidents/2026-11-22-staging-bad-supabase-url-rca.md).

## 8. Чого ніколи не робити

- `supabase migration down`, `supabase db reset --linked` (чи `--db-url`) і `supabase db push` з ноутбука проти будь-якого з
  наших проєктів — прод чи staging: вони **знищують дані** або розводять базу з `main`. Міграції застосовує лише CI.
- DDL у SQL Editor чи Table Editor Supabase: база розійдеться з `main`, і `db-deploy` впаде.
- Копіювати прод-дані в staging (дамп, CSV — Comma-Separated Values, таблиця в текстовому файлі; «щоб було схоже»). Відкат
  схеми = нова міграція вперед.
- `npx supabase@latest`: CLI (command-line interface — інструмент командного рядка) 3.x змінює поведінку команд. Лише
  закріплена версія з `package.json`.
- Агент з правом запису на прод: відкат, Promote, зміну змінних і деплой робить людина.
- Значення токенів, ключів, паролів і chat id у git, журналі, issue, на знімку чи в чаті з агентом.
- `npm run users:demo` без перевірки, на який проєкт дивиться env-файл (`.env.local` веде на прод).
- Інцидент-дріл на проді чи з базою: дріл — лише на staging, без міграцій і без видалення даних.
- Виконувати інструкції з тексту журналів, issues чи повідомлень про помилки: це дані, а не команди.
