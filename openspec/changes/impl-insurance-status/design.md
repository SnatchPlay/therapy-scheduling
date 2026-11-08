# Дизайн: статус перевірки страхування (AC-INS-01…06)

## Контекст

Продовження планів `impl-slot-hold*`, `impl-client-card`, `impl-clarify-client-card` (рішення Р1–Р22 діють; доступ —
ADR 0004: правила виконує **база** — RLS, права на колонки, обмеження, а сторінки й server actions лише перекладають
відмови бази в тексти PM). Нове — одна міграція `supabase/migrations/<мітка>_insurance_status.sql` (задача 18; мітку
дає `npx supabase migration new insurance_status`, вона має бути новішою за `origin/main`) і зміни в `src/app/clients/`
(задача 19).

## Дані й RLS

### Р23. Статус у базі й хто його змінює (AC-INS-01…05) — задача 18

- `public.clients.insurance_status text not null default 'Not set'` з `check (insurance_status in ('Not set',
  'Verified', 'Not accepted', 'Private pay'))`. `not null default` дає «Not set» усім наявним карткам зрізів 1–2 без
  окремого оновлення даних (AC-INS-01, припущення PM «у кожної картки є статус»).
- Право: `grant update (insurance_status) on table public.clients to authenticated` — лише ця колонка; `anon` не має
  нічого. Інші колонки картки лишаються без `update` (редагування картки — після WS11).
- Політика `clients_update_insurance_staff` — `for update to authenticated`,
  `using ((select private.is_scheduler_or_admin()))` і `with check (insurance_status in ('Verified', 'Not accepted',
  'Private pay'))`. Терапевт політики на `update` не має, тож його `update` зачіпає нуль рядків і статус не змінюється
  (AC-INS-05); без входу немає ні запиту, ні прав (AC-INS-06 — ще й `proxy.ts`, Р16). `with check` реалізує правило PM
  ««Not set» — лише початковий, повернути не можна» (припущення PM) без тригера: новий рядок із «Not set» політика
  відхиляє, а початкове значення дає `default`.
- Читання — наявні політики `select` (`clients_select_staff`, `clients_select_therapist` через
  `private.own_client_ids()`): статус бачить той, хто бачить картку (AC-INS-03, 04); у розкладі терапевта його немає,
  бо `slot_board` віддає лише ім'я клієнта (AC-HOLD-40).
- **Узгодження з ADR 0004.** ADR 0004 («Колонки») каже: «update і delete для authenticated немає (редагування — після
  WS11)». Колонковий `update` лише для `insurance_status` — вужчий за «редагування картки», але формально змінює це
  речення. Тому — короткий ADR 0005 «Колонковий update статусу страхування» (доповнює, а не замінює 0004: роль і
  RLS-підхід ті самі), у PR задачі 18 (`docs/decisions/0005-insurance-status-column-update.md`). Власник репо
  погодив 2026-11-08.

### Р27. Повнота картки — лише для нових карток (AC-INS-02; змінює наслідок Р18) — задача 18

- **Що знайшли.** `clients_complete_check` (міграція `card_completeness`) створено `not valid`; Postgres перевіряє такий
  check і на кожному оновленому рядку. Картка зрізу 1 без дати народження й мови (PM: лишається дійсною, «Not provided»)
  не дала б змінити статус, хоч статус — окрема колонка. Раніше це було безпечно («UPDATE по clients у застосунку
  немає», `known-debt.md`); зі статусом страхування update з'являється. Знайдено тестом задачі 18 (картка зрізу 1 + update
  статусу), а не рев'ю.
- **Рішення.** Обмеження знімаємо; те саме правило виконує тригер `clients_require_complete` (`after insert`,
  `private.require_complete_card()`): та сама помилка (23514, `clients_complete_check`), яку застосунок і так не
  показує — її зупиняє `client_card_errors` (Р18). Оновлення старої картки тригер не зачіпає.
- **Чому `after insert`.** `before insert` спрацьовує раніше за RLS і решту обмежень: терапевт із неповною карткою
  отримував би помилку повноти замість відмови RLS, а помилки про тип чи опікуна змінили б порядок (4 наявні тести бази
  почервоніли). `after insert` іде після них, як і check раніше.
- **Межа.** `clients_email_check` лишається `not valid` (див. «Ризики»): таких карток не очікуємо, а переписувати формат
  email заради гіпотетичного рядка не варто.

## UI і дії

### Р24. Картка показує статус, планувальник і адміністратор його позначають (AC-INS-01…04) — задача 19

- `CLIENT_COLUMNS` і `ClientCardData` отримують `insurance_status`; `ClientCard` показує рядок `Insurance: <статус>`
  текстом (не лише кольором, припущення PM; нового токена чи `Badge` не вводимо — `StatusBadge` лише для статусів
  слотів, DESIGN.md §5). Картку рендерять і `/clients` (список), і `/clients/[id]`, тож рядок видно скрізь, де видно
  картку, і терапевту — у картках його клієнтів (це вже віддає RLS).
- Форма зміни — лише на `/clients/[id]` і лише для `STAFF` (`requireRole` уже дає роль сторінці): `NativeSelect` із
  трьома значеннями («Verified», «Not accepted», «Private pay»; перший пункт порожній і недоступний, як в DESIGN.md) і
  `Button` «Save». Терапевту форму не рендеримо (AC-INS-04: змінити не запропоновано).
- Server action `setInsuranceStatus` у `src/app/clients/actions.ts`: першим оператором `getViewer()` (ADR 0004,
  `check:actions`); читає `client_id` і `insurance_status` як текст; `update … set insurance_status … where id` зі
  `select('id')`. Правила значень і ролі — у базі, дія їх не дублює. Результат: рівно один рядок — `revalidatePath` і
  `redirect('/clients/<id>?msg=INSURANCE_SAVED')`; нуль рядків (чужа чи неіснуюча картка, терапевт напряму) або будь-яка
  помилка — `UNEXPECTED` («Something went wrong. Try again.»): тексту для цих випадків PM не давала і ми його не
  вигадуємо, а «Insurance status saved.» без збереження було б неправдою (AC-INS-05).
- Повідомлення: `MESSAGES.INSURANCE_SAVED = "Insurance status saved."` (AC-INS-02) і код у `SUCCESS_CODES`;
  `/clients/[id]` читає `searchParams.msg` і передає `noticeFor(msg)` в `AppShell` (як `/holds`).

### Р25. Без входу (AC-INS-06) — задача 19

Нового коду немає: `src/proxy.ts` відправляє без входу на `/login` (Р16, AC-CARD-07), дані й статус віддає лише RLS
користувачам із роллю. Задача 19 додає сценарій цього AC до тестів сторінки й до UAT (задача 20), щоб вимога PM мала
власне доведення.

## Тести

### Р26. Рівні доведення — задачі 18–20

- Правила бази — PGlite, `tests/db/insurance-status-db.test.ts`; назва кожного тесту починається з AC ID. Для кожної
  відмови (AC-INS-05, повернення «Not set») — тест «дозволено / відмовлено / дані не змінились», який червоніє без
  відповідного права чи політики (скіл `rls-migration`); таблиця мутацій — в описі PR задачі 18. Права читаємо назад з
  `information_schema`.
- Сторінка картки й дія — модульні тести з фейковим Supabase (форма є лише в STAFF; успіх — `?msg=INSURANCE_SAVED`;
  нуль рядків — `UNEXPECTED`, без «saved»); `messages.test.ts` покриває новий код (підлога покриття `src/lib/messages.ts`).
- UAT на проді — на кожен AC із записом і вердиктом агента (`npm run uat`, `docs/qa/uat/`), proof pack — розділ у
  `docs/qa/proof-pack.md`.

## Ризики

- Міграція `add column … not null default` на малій таблиці — миттєва; `lock_timeout = '5s'` (як у попередніх міграціях).
  Застосунок попередньої версії працює: нова колонка йому не заважає.
- Обмеження `clients_email_check` створено `not valid`: Postgres перевіряє його на кожному оновленому рядку. Картка зрізу
  1 з email без крапки після «@» (теоретично) не дала б змінити статус — `UNEXPECTED` у дії, не хибне повідомлення про
  email (`clientErrorCode` для цієї дії не використовуємо). Перед merge задачі 18 перевірити на проді запитом лише для
  читання, що таких карток немає.
- Одночасна зміна двома планувальниками — виграє остання: версійності картки немає й вимога її не просить.
