# Чекліст розробника, день 0

<!--
Докази — посилання (run CI, PR), назви змінних і знімки екрана в docs/img/. Значень секретів і паролів тут немає.
-->

Моє репо: https://github.com/SnatchPlay/therapy-scheduling · Прод-URL: https://therapy-scheduling-weld.vercel.app
Репо вимог PM: https://github.com/Sofiia-pm/therapy-scheduling-spec · Організація Supabase: особистий акаунт (Free)

## 1. Інструменти й репо

- [x] Node 24 (`node -v` → `v24.16.0`), Git, GitHub CLI (`gh auth status` — увійдено як SnatchPlay); OpenSpec CLI
      глобально `1.14.1` (`openspec --version` → `1.14.1`, телеметрію вимкнено)
- [x] Репо створено з шаблону (`gh repo create therapy-scheduling --public --template koldovsky/2026-quitcode-06-project-template`),
      власник — особистий акаунт, **Public** — https://github.com/SnatchPlay/therapy-scheduling
- [x] `gh repo clone` → `npm ci` → `.env.local` з `.env.example` (значення — лише локально)
- [x] CodeRabbit (GitHub App) встановлено лише на це репо (Only select repositories → `therapy-scheduling`, 2026-10-20);
      рев'ю працює: перевірка «CodeRabbit · Review completed» у https://github.com/SnatchPlay/therapy-scheduling/pull/6.
      PR #1–#4 злито до встановлення; на злитих PR CodeRabbit відповідає «Pull request is closed», тому всю роботу
      переглянуто окремим PR https://github.com/SnatchPlay/therapy-scheduling/pull/5 (закрито без злиття)
- [x] Denylist: PM списку справжніх назв не надсилала (`npm run spec:check` → «слів у denylist: 0»)

## 2. Supabase: власна база

- [x] Власний проєкт Supabase в особистому акаунті (Free); `db-deploy` підключається до нього через Session pooler (run нижче)
- [x] Authentication: «Allow new users to sign up» **вимкнено**, «Confirm email» **вимкнено** — `docs/img/auth-signups.png`
- [ ] Authentication → URL Configuration: Site URL = прод-URL Vercel; Redirect URLs `http://localhost:3000/**`,
      `https://*-snatchplays-projects.vercel.app/**` — ще не підтверджено знімком
- [x] `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
      `DEMO_USER_PASSWORD` (лише назви; значень у репо й чаті немає)

## 3. GitHub: environment `production` і секрети

- [x] Environment `production`, Deployment branches = Selected branches → `main`
      (`gh api …/environments/production` → `custom_branch_policies: true`, політика `main`)
- [x] Секрет environment `SUPABASE_DB_URL` (Session pooler, порт 5432) — задано 2026-10-20 (`gh secret list --env production`
      → `SUPABASE_DB_URL`); секретів репозиторію з паролем бази немає
- [x] Запасний шлях — не потрібен
- [ ] (Необов'язково) `SPEC_DENYLIST` — не задано: PM не надсилала списку

## 4. Vercel

- [x] Add New → Project → імпорт `SnatchPlay/therapy-scheduling`; preview на кожен PR (бот Vercel у PR #2–#6)
- [x] Змінні Production і Preview — лише `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `SUPABASE_SECRET_KEY` у Vercel немає — `docs/img/vercel-env.png`
- [x] Deployment Protection → **Require Log In** вимкнено — `docs/img/vercel-require-login-off.png`; перевірка 2026-10-20:
      `curl` на `/login` preview з PR #6 → `200` без перенаправлення на `vercel.com/sso-api` (до вимкнення — `302` туди)
- [x] Прод-URL https://therapy-scheduling-weld.vercel.app відкривається (`curl …/login` → `200`); вхід як `admin@example.test`
      показує роль `admin` — `docs/img/prod-login-admin.png`

## 5. База й перший зелений CI

- [x] Actions → CI → Run workflow (`main`, `include_seed` ✓) → `db-deploy` застосував `20261012000000_profiles_and_roles.sql`
      і `supabase/seed.sql` — https://github.com/SnatchPlay/therapy-scheduling/actions/runs/39438432639
- [x] `npm run users:demo` (2026-10-20): `admin@example.test — створено, роль admin`, `member1@example.test` і
      `member2@example.test — створено, роль member` (вивід скрипта; пароль не друкується)
- [x] Вхід як `admin@example.test` на прод-URL — `docs/img/prod-login-admin.png`
- [x] CI на `main` зелений: `spec`, `app`, `conformance`, `db-check`, `db-deploy` — https://github.com/SnatchPlay/therapy-scheduling/actions/runs/39438432639

## 6. Ruleset `solo-main` (після зеленого CI на `main`)

- [x] Ruleset `solo-main` (id 25410688) з `materials/rulesets/solo-main.json` курсу через `gh api …/rulesets --method POST`:
      default branch, deletion, non_fast_forward, pull request з 0 approvals і методами squash + merge, обов'язкові
      `spec`, `app`, `conformance`, `db-check` (GitHub Actions), без bypass, enforcement `active`;
      rebase merging вимкнено в налаштуваннях репо

## 7. Перший PR (перевірка ruleset-у)

- [x] Усі зміни в `main` — лише через PR: #1, #2, #3, #4, #6 (squash), кожен із зеленими обов'язковими перевірками;
      цей PR — `setup/bootstrap`
- [x] Vercel створив preview для кожного PR (коментар бота Vercel у PR #2–#6)
- [ ] (З першою задачею, що має міграцію) — задач у WS6 немає: реалізацію перенесено на WS7

## 8. Вимоги PM і специфікація

- [x] Адресу репо вимог PM узято з чату команди
- [x] `/requirements-sync Sofiia-pm/therapy-scheduling-spec` → https://github.com/SnatchPlay/therapy-scheduling/pull/1;
      друга синхронізація після уточнень PM → https://github.com/SnatchPlay/therapy-scheduling/pull/3
- [x] Питання — issues «Питання до вимог» через вебформу: Sofiia-pm/therapy-scheduling-spec#6, #7, #8, #9;
      журнал `docs/spec-reading.md`
- [x] Переклад у специфікацію: `add-slot-hold` → https://github.com/SnatchPlay/therapy-scheduling/pull/2;
      уточнення `clarify-slot-hold` (MODIFIED / ADDED) → https://github.com/SnatchPlay/therapy-scheduling/pull/4;
      `npm run ac:coverage` без «вимогу PM ще не перекладено»
