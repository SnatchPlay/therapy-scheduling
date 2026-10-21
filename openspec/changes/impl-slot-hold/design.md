# Дизайн: утримання слоту терапевта (зріз 1)

## Контекст

Специфікація — `openspec/specs/client-cards/spec.md` і `openspec/specs/slot-holds/spec.md` (знімок вимог PM
2026-10-19). Головні ризики зрізу: два утримання одного слоту (AC-HOLD-03, AC-HOLD-04), межі часу (24 години —
AC-HOLD-05/06; початок слоту — AC-HOLD-07, AC-HOLD-22/23) і видимість для терапевта (AC-HOLD-09, AC-HOLD-21). Усі три
вирішує база, а не код застосунку: Data API доступний з публічним ключем із бандла, тож правило лише в server action
обходиться прямим запитом.

## Рішення

### Р1. Ролі `admin`, `scheduler`, `therapist` (матриця прав `requirements/product.md`)

Нова міграція за правилом шаблону: зняти `profiles_role_check` → `member` → `scheduler` → default `therapist`
(найменші права: новий користувач без рядка терапевта не бачить нічого) → новий `profiles_role_check`.
`supabase/demo-users.json`: `admin@example.test`, `scheduler1@example.test`, `scheduler2@example.test`,
`therapist1@example.test`, `therapist2@example.test`.
Роль — лише з `profiles.role` через `private.current_app_role()`. Колонковий `grant update (full_name)` з міграції
шаблону лишається: `authenticated` не змінює `role` нікому, зокрема собі. Призначення ролей у зрізі 1 — лише
`npm run users:demo` (service role, локально); екрана керування ролями немає (його AC — не в цьому зрізі).

### Р2. Картка клієнта — `public.clients` (AC-HOLD-10, 11, 15, 16)

`id`, `full_name`, `email`, `created_by` (default `auth.uid()`), `created_at`. Правила — обмеження таблиці, одне
джерело правди для форми й Data API:

- `clients_full_name_check`: `btrim(full_name) <> ''` (AC-HOLD-11);
- `clients_email_check`: `email ~ '^[^@\s]+@[^@\s]+$'` (AC-HOLD-15);
- email нормалізує тригер `before insert` (`lower(btrim(email))`), далі `clients_email_key`: `unique (email)` —
  `Client1@Example.test` і « client1@example.test » — дубль client1@example.test (AC-HOLD-16; власне припущення в
  `docs/spec-reading.md`: нормалізація даних, а не бізнес-рішення).

GRANT: `select`, `insert (full_name, email)`; політики: insert і select — `admin`/`scheduler`; терапевт бачить лише
клієнтів своїх непрострочених утримань і сеансів (Р5). Server action перекладає `23514` → «Enter the client's name
and a valid email.», `23505` → «A client with this email already exists.».

### Р3. Терапевти й слоти — `public.therapists`, `public.slots` (AC-HOLD-01, 18)

- `therapists`: `id`, `email` (unique), `full_name`. Користувач-терапевт пов'язаний з рядком через
  `profiles.email` (його ставить тригер з Auth, користувач змінити не може — колонковий grant лише `full_name`):
  `private.current_therapist_id()`.
- `slots`: `id`, `therapist_id`, `starts_at`, `ends_at`; `unique (therapist_id, starts_at)`,
  `check (ends_at = starts_at + interval '60 minutes')`.
- Початкові дані — у міграції (`insert … on conflict do nothing`), бо сид у хмарі вже виконано: therapist1 і
  therapist2, будні 2026-10-19…2026-12-31, слоти 09:00–16:00 America/Los_Angeles (`generate_series` +
  `at time zone`). Окремого обмеження «без перетину» не ставимо: слоти — лише сид по 60 хвилин з початку години,
  редагування доступності поза зрізом.
- Запис у `therapists` і `slots` для `authenticated` не видаємо.

### Р4. Утримання — `public.holds` і функції (AC-HOLD-02…08, 12…14, 17, 19, 22, 23)

`holds`: `id`, `slot_id`, `client_id`, `created_by`, `created_at`, `confirmed_at`, `confirmed_by`. Статус не
зберігаємо — рахуємо в момент читання від `created_at` (прострочення без фонової задачі, «Що поза scope» PM):

| Умова | Статус |
|---|---|
| `confirmed_at is not null` | «Confirmed» |
| `now() >= created_at + interval '24 hours'` | «Expired» |
| інакше | «Held» |

`interval '24 hours'` — рівно 1440 хвилин незалежно від переходу на літній/зимовий час (припущення PM).

- **Утримання** — `public.hold_slot(slot_id, client_id)` (`security invoker`): роль не `admin`/`scheduler` →
  `HOLD_FORBIDDEN` (AC-HOLD-08); далі `insert`. Тригер `before insert` (`private.guard_new_hold`,
  `security definer`) **блокує рядок слоту** (`select … for update`), тож дві одночасні спроби йдуть по черзі
  (AC-HOLD-04). Одразу після замка бере `v_now := clock_timestamp()` (`now()` — час початку транзакції, яка
  могла чекати на замок) і перевіряє: слот почався (`starts_at <= v_now`) → `SLOT_STARTED` (AC-HOLD-07); є
  активне утримання чи сеанс → `SLOT_UNAVAILABLE` (AC-HOLD-03, 04, 17); ставить `created_at = v_now`,
  `created_by = auth.uid()`, обнуляє `confirmed_*`. Прямий `insert` через Data API проходить той самий тригер.
- **Підтвердження** — `public.confirm_hold(hold_id)` (`security invoker`): роль → `CONFIRM_FORBIDDEN` (AC-HOLD-14);
  `update … set confirmed_at`. Тригер `before update of confirmed_at` (`private.guard_confirm`) блокує слот і
  перевіряє в такому порядку: уже підтверджено або на слоті є **інше** активне утримання чи сеанс →
  `SLOT_UNAVAILABLE`; прострочено → `HOLD_EXPIRED` (AC-HOLD-13); слот почався → `CONFIRM_SLOT_STARTED`
  (AC-HOLD-22, 23). «Прострочено» раніше за «почався» — власне припущення в `docs/spec-reading.md`. Час для цих
  перевірок і для `confirmed_at` — `v_now := clock_timestamp()` після блокування: транзакція могла чекати на
  замок довше за межу 24 годин. Ставить `confirmed_at = v_now`, `confirmed_by = auth.uid()`. Останній запобіжник подвійного сеансу —
  `unique (slot_id) where confirmed_at is not null`.
- GRANT: `select`, `insert (slot_id, client_id)`, `update (confirmed_at)`; політики insert/update — лише
  `admin`/`scheduler` (AC-HOLD-19: admin = scheduler).
- Коди помилок — текст `raise exception`; `src/lib/messages.ts` — єдине місце, де код стає текстом PM.

### Р5. Читання — представлення з `security_invoker` (AC-HOLD-01, 02, 05, 06, 09, 18, 20, 21)

- `public.slot_board`: слот + його активне утримання чи сеанс → `status` (`Free` / `Held` / `Confirmed`), клієнт,
  `held_until`, `holdable` (`Free` і ще не почався). `public.day_slots(therapist_id, day)` — слоти дня за
  America/Los_Angeles; `security invoker`, тож діє RLS `slots`: терапевт, який передає чужий `therapist_id`,
  отримує порожній список (AC-HOLD-09), `scheduler` і `admin` — слоти будь-якого терапевта.
- `public.hold_list`: утримання зі статусом `Held` / `Expired` / `Confirmed` (AC-HOLD-20).
- RLS терапевта: `slots` і `therapists` — лише власні; `holds` — лише власних слотів і не прострочені (AC-HOLD-21);
  `clients` — лише з таких утримань. Представлення з `security_invoker = true` успадковують ці політики, тож
  терапевт ніде не побачить чужого (AC-HOLD-09).

### Р6. Сторінки й server actions

| Шлях | Хто | Що |
|---|---|---|
| `/` | усі | перенаправлення: терапевт → `/schedule`, інші → `/slots` |
| `/clients` | admin, scheduler | список і форма клієнта (AC-HOLD-10, 11, 15, 16) |
| `/slots` | admin, scheduler | терапевт + день → слоти зі статусами, утримання за клієнтом; «No free slots on this day.», над усіма слотами дня, якщо немає слоту, який ще можна утримати; день без слотів — лише повідомлення (AC-HOLD-01…07, 17, 18, 24) |
| `/holds` | admin, scheduler | усі утримання зі статусом і кнопкою підтвердження (AC-HOLD-12, 13, 19, 20, 22, 23) |
| `/schedule` | therapist | усі власні утримання й сеанси без прострочених і слоти обраного дня (AC-HOLD-09, 21; період — питання Sofiia-pm/therapy-scheduling-spec#9) |

Повідомлення — через `?msg=<код>` після `redirect`, без клієнтського JS. Час — `src/lib/time.ts`:
`РРРР-ММ-ДД ГГ:ХХ` за America/Los_Angeles (`Intl.DateTimeFormat`, `hourCycle: "h23"`).

### Р7. Тести

- Правила бази — на справжньому Postgres у WASM (PGlite, devDependency `@electric-sql/pglite`) з усіма міграціями:
  `tests/db/supabase-pglite.ts` — взято з демо курсу з посиланням на джерело (дозволено README домашки). Межі часу
  перевіряємо зсувом `created_at` / `starts_at` від `now()` на точні хвилини (1439 / 1440).
- PGlite — одне з'єднання: AC-HOLD-04 перевіряє дві спроби, запущені разом, і що лишилось рівно одне утримання;
  справжню паралельність забезпечує блокування рядка слоту (Р4), окремо її не імітуємо.
- Формат часу й тексти повідомлень — модульні тести.

## Ризики

- Сид слотів закінчується 2026-12-31 — для навчального тижня достатньо; продовження — нова міграція.
- База одна для проду й preview: дані синтетичні, `SUPABASE_SECRET_KEY` у Vercel немає.
