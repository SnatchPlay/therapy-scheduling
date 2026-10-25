# Дизайн: картка клієнта й доступ терапевта (AC-CARD-01…11, AC-HOLD-37…42)

## Контекст

Продовження планів `impl-slot-hold*` (рішення Р1–Р11 діють): застосунок працює на Next.js 16 + Supabase; публічний ключ
у браузері, тож Data API доступний кожному, і правила доступу виконує **база** (RLS, права на колонки, тригери), а не
сторінки чи Server Actions. Нове — у міграціях `supabase/migrations/20261025…_client_card.sql` (задача 8) і
`…_hold_list_rules.sql` (задача 10) та в застосунку.

## UI

### Р14. Сторінки (AC-CARD-01…11) — задача 9

- `/clients` — список: планувальник і адміністратор бачать усі картки, терапевт — свої (те, що віддає RLS); порожній
  список терапевта — «No clients yet. Clients appear here when a scheduler holds a slot with you.» (AC-CARD-09).
- `/clients/new` — форма картки: тип («Adult» / «Child»), ім'я, дата народження, мова сеансів; email клієнта для
  «Adult», ім'я й email опікуна для «Child». Відкривається за посиланням для будь-якої ролі; терапевт при спробі
  зберегти бачить «Only schedulers and admins can create client cards.» (AC-CARD-06) — відмову дає база (RLS), дія лише
  перекладає код помилки. Після помилки введені дані лишаються у формі (AC-CARD-03): дія повертає код і значення полів
  у `?msg=…` не передає (персональні дані в URL заборонені), а рендерить форму зі збереженими значеннями через
  `useActionState`.
- `/clients/[id]` — картка зі всіма даними анкети; відсутні поля — «Not provided» (картки зрізу 1). Чужа чи неіснуюча
  картка для терапевта — «You don't have access to this client.» без даних (AC-CARD-05, 08); для планувальника й
  адміністратора неіснуюча — «Client not found.» (власне припущення, Q2).
- Без ролі (AC-CARD-11): будь-яка сторінка, що вимагає роль, повертає на `/`, де лише «Your account has no access yet.
  Contact an administrator.»; без входу (AC-CARD-07) — `src/proxy.ts` перенаправляє на `/login`.
- У виборі клієнта на `/slots` біля дитини — email опікуна (AC-CARD-02); дорослий — свій email.
- Компоненти: `Card` зі `shadcn` (додаємо разом з першим екраном картки), історії Storybook для картки й форми.

## Дані й RLS

### Р12. Картка в базі (AC-CARD-01, 02, 03; AC-HOLD-39, 41) — задача 8

- `clients`: нові колонки `client_type` (`Adult` | `Child`, default `Adult` — картки зрізу 1), `birth_date date`,
  `session_language` (`English` | `Spanish`), `guardian_name`, `guardian_email`; `email` стає nullable (у дитини власного
  немає). Обмеження: для `Adult` — `guardian_*` порожні й `email` є; для `Child` — `email` порожній, `guardian_name` і
  `guardian_email` є (AC-CARD-03 → код `INVALID_GUARDIAN`). Повнота нових карток (дата народження й мова обов'язкові) —
  `check … not valid`: діє для нових і змінених рядків, картки зрізу 1 лишаються дійсними («Not provided»).
- Дата народження не пізніше за сьогодні (за часом практики America/Los_Angeles): тригер `before insert` — `current_date`
  у `check` не можна (не immutable). Те саме для email опікуна: нормалізація (нижній регістр, без пробілів по краях) і
  формат — одне джерело `private.blank_chars()`.
- AC-HOLD-39: регулярний вираз `clients_email_check` вимагає крапку в частині після «@» (міграція замінює старе
  обмеження новим: `drop constraint` + `add constraint`; наявні email мають крапку, тож `not valid` не потрібен).
- AC-HOLD-41: тригер обрізає пробіли по краях `full_name` (і `guardian_name`) до перевірки `clients_full_name_check`.
- Права: `grant insert (full_name, email, client_type, birth_date, session_language, guardian_name, guardian_email)` —
  `created_by`, `created_at`, `id` ставить база; update і delete для `authenticated` немає.

### Р13. Хто бачить які картки (AC-CARD-04, 05, 06, 08, 09, 10) — задача 8

- Політики `clients` (по одній на операцію): `select` для staff — усі; `select` для терапевта — лише «свої»: клієнти з
  утриманням «Held» або сеансом «Confirmed» у слотах цього терапевта. Зараз така політика (`clients_select_therapist`)
  спирається на RLS таблиці `holds` («власні, не прострочені»). Робимо явно, незалежно від RLS іншої таблиці:
  `private.own_client_ids()` — `security definer`, `set search_path = ''`, повертає множину (`setof uuid`), політика
  `id in (select private.own_client_ids())`; тоді зміна політики `holds_select` не відкриє чужих клієнтів мовчки.
- Терапевт із чужим чи неіснуючим id отримує нуль рядків: застосунок не відрізняє «чужа» від «немає» (Q2, варіант A).
- `insert`: лише staff (`private.is_scheduler_or_admin()`), `created_by = (select auth.uid())`; терапевт — відмова
  `42501`.
- Користувач без ролі (AC-CARD-11): `profiles.role` стає nullable без default (було `therapist`) — найменші права
  означають «жодних»; `profiles_role_check` — `role is null or role in (…)`. `private.current_app_role()` повертає
  `null`, усі хелпери (`is_scheduler_or_admin`, `current_therapist_id`) дають `false`. Демо-скрипт приймає
  `"role": null` явно (newuser1@example.test).

### Р15. Списки зрізу 1, що розійшлися з вимогою (AC-HOLD-37, 38, 40, 42) — задача 10

- `hold_list` лишає лише «Held» і «Expired» із слотом, що ще не почався (AC-HOLD-38 — без «Confirmed»; AC-HOLD-42 — без
  «Held» зі слотом, що почався; «Expired» зі слотом, що почався, і так сховано — AC-HOLD-29). Порядок — за часом слоту
  від найближчого: `order by starts_at, hold_id` на сторінці `/holds`.
- AC-HOLD-37: прострочене утримання клієнта, якого вже знову утримали на той самий слот, зникає зі списку:
  `not exists (newer hold on the same slot for the same client)`.
- AC-HOLD-40: поведінка вже є (`slot_board` віддає лише `client_name`) — додаємо тест із цим ID; email терапевт бачить
  лише в картках своїх клієнтів.

## Тести

Правила бази — PGlite (`tests/db/client-card-db.test.ts`, `tests/db/hold-list-db.test.ts`); назва кожного тесту
починається з AC ID; для кожної відмови (AC-CARD-03, 05, 06, 07, 08, 11) — тест, який червоніє без правила
(таблиця мутацій у PR задачі 8). Сторінки — модульні тести з фейковим Supabase. Права читаємо назад із
`information_schema` у тесті.

## Ризики

- Повторне створення політики `clients_select_therapist`: `drop policy` і `create policy` в одній міграції, тобто в одній транзакції: вікна без
  політики немає.
- Зміна default ролі: вже створені користувачі не змінюються; нові без явної ролі більше не стають терапевтами.
- `hold_list` змінюється через `create or replace view` (колонки ті самі): застосунок попередньої версії працює.
