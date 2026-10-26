# Дизайн-система: Therapy Scheduling

- **Джерело:** артефакт Claude Design (Design System) https://claude.ai/artifact/R7anyEbCpLG6LFAK9EB27a — приватний, для рецензента в PR є знімок; промпт і вибір (стриманий бірюзовий акцент, радіус 8 px) — в описі PR дизайн-системи. Токени й контраст пораховано скриптом (WCAG, OKLCH → sRGB).
- **Вхід від PM:** розділ «Вигляд і тон» у `requirements/product.md` (знімок 2026-10-25): тон спокійний, стриманий, охайний; світлий нейтральний фон і темний текст; один приглушений акцент; червоний лише для помилок; середня щільність; тексти англійською; статуси з підписом і кольором.
- **Код:** токени — `src/app/globals.css`; компоненти — `src/components/ui/` (shadcn/ui, Base UI); перевірка — `npm run check:design`

## 1. Огляд

Інтерфейс для працівників практики психотерапії (планувальники, адміністратор, терапевти): вони відкривають його щодня між сеансами й дзвінками, на робочому столі, частіше у світлій темі, а за системою — і в темній. Тон: спокійний, стриманий, охайний; без прикрас, емодзі й «дружніх» вигуків. Щільність середня: розклад і списки компактні (рядок 36–40 px), форми просторі. Тексти англійською, коротко й ввічливо: повідомлення каже, що сталося і що робити далі. Дата й час — `YYYY-MM-DD HH:MM` за часом практики.

## 2. Кольори

Семантичні токени з іменами shadcn/ui, значення в OKLCH. У сторінках — лише утиліти з колонки «Клас»; ніколи hex, `bg-[#…]`, сирі палітри (`zinc-500`, `bg-white`). Темна тема — за системою (`prefers-color-scheme`), перемикача немає.

**Один приглушений акцент — `primary` (бірюзовий).** Червоний — лише `destructive`, лише для помилок. Статус слота не червоний і не залежить від кольору: завжди слово й знак.

| Токен | Для чого | Світла | Темна | Клас |
|---|---|---|---|---|
| `background` / `foreground` | тло сторінки й основний текст | `oklch(0.985 0.004 200)` / `oklch(0.23 0.02 215)` | `oklch(0.19 0.015 215)` / `oklch(0.95 0.008 200)` | `bg-background`, `text-foreground` |
| `card` / `card-foreground` | картки, таблиці, поля, панелі | `oklch(1 0 0)` / `oklch(0.23 0.02 215)` | `oklch(0.235 0.016 215)` / `oklch(0.95 0.008 200)` | `bg-card`, `text-card-foreground` |
| `popover` / `popover-foreground` | меню вибору, діалоги | `oklch(1 0 0)` / `oklch(0.23 0.02 215)` | `oklch(0.26 0.017 215)` / `oklch(0.95 0.008 200)` | `bg-popover`, `text-popover-foreground` |
| `primary` / `primary-foreground` | одна основна дія на екран, посилання, вибраний пункт | `oklch(0.46 0.075 200)` / `oklch(0.985 0.004 200)` | `oklch(0.78 0.09 195)` / `oklch(0.2 0.03 205)` | `bg-primary`, `text-primary-foreground`, `text-primary` |
| `secondary` / `secondary-foreground` | друга дія | `oklch(0.95 0.012 200)` / `oklch(0.28 0.03 210)` | `oklch(0.3 0.02 212)` / `oklch(0.93 0.01 200)` | `bg-secondary`, `text-secondary-foreground` |
| `muted` / `muted-foreground` | шапка таблиці, вимкнене поле; підписи й допоміжний текст | `oklch(0.955 0.008 200)` / `oklch(0.46 0.02 215)` | `oklch(0.27 0.017 214)` / `oklch(0.74 0.02 205)` | `bg-muted`, `text-muted-foreground` |
| `accent` / `accent-foreground` | наведення, вибраний рядок | `oklch(0.925 0.03 195)` / `oklch(0.28 0.05 205)` | `oklch(0.33 0.04 200)` / `oklch(0.95 0.015 195)` | `bg-accent`, `text-accent-foreground` |
| `destructive` / `destructive-foreground` | помилка (текст, межа поля), небезпечна дія | `oklch(0.5 0.19 27)` / `oklch(0.985 0 0)` | `oklch(0.72 0.17 25)` / `oklch(0.2 0.04 25)` | `text-destructive`, `border-destructive`, `bg-destructive text-destructive-foreground` |
| `border` | розділювачі й краї карток (декоративні) | `oklch(0.9 0.008 205)` | `oklch(0.33 0.015 212)` | `border-border` |
| `input` | межа поля, вибору, контурної кнопки (значуща, ≥ 3:1) | `oklch(0.58 0.02 212)` | `oklch(0.62 0.02 205)` | `border-input` |
| `ring` | кільце фокусу | `oklch(0.5 0.085 200)` | `oklch(0.78 0.09 195)` | `ring-ring`, `outline-ring` |
| `status-free` / `-foreground` | статус Free | `oklch(0.955 0.008 200)` / `oklch(0.4 0.03 210)` | `oklch(0.27 0.017 214)` / `oklch(0.82 0.02 205)` | `bg-status-free text-status-free-foreground` |
| `status-held` / `-foreground` | статус Held (утримання до 24 год) | `oklch(0.94 0.07 88)` / `oklch(0.38 0.08 70)` | `oklch(0.34 0.06 80)` / `oklch(0.9 0.09 90)` | `bg-status-held text-status-held-foreground` |
| `status-confirmed` / `-foreground` | статус Confirmed (сеанс) | `oklch(0.93 0.05 160)` / `oklch(0.36 0.08 160)` | `oklch(0.33 0.05 160)` / `oklch(0.9 0.08 160)` | `bg-status-confirmed text-status-confirmed-foreground` |
| `status-expired` / `-foreground` | статус Expired (прострочене утримання, не червоний) | `oklch(0.94 0.03 45)` / `oklch(0.4 0.06 40)` | `oklch(0.33 0.04 45)` / `oklch(0.88 0.06 50)` | `bg-status-expired text-status-expired-foreground` |
| `status-past` / `-foreground` | статус Past (слот уже почався) | `oklch(0.93 0.006 230)` / `oklch(0.44 0.015 230)` | `oklch(0.29 0.008 230)` / `oklch(0.76 0.015 230)` | `bg-status-past text-status-past-foreground` |

### Контраст

Пораховані співвідношення WCAG для пар у обох темах. Текст ≥ 4.5:1, межі полів і фокус ≥ 3:1. `border` — декоративний розділювач і навмисно світліший; усе, що несе зміст (поле, контурна кнопка), має межу `input`.

| Пара | Світла | Темна | Норма |
|---|---|---|---|
| `foreground` на `background` | 16.1:1 | 16.0:1 | ≥ 4.5 |
| `card-foreground` на `card` | 16.8:1 | 14.4:1 | ≥ 4.5 |
| `muted-foreground` на `background` | 6.8:1 | 8.0:1 | ≥ 4.5 |
| `muted-foreground` на `muted` | 6.2:1 | 6.6:1 | ≥ 4.5 |
| `primary-foreground` на `primary` | 6.6:1 | 9.3:1 | ≥ 4.5 |
| `primary` на `background` | 6.6:1 | 9.5:1 | ≥ 4.5 |
| `secondary-foreground` на `secondary` | 12.5:1 | 11.1:1 | ≥ 4.5 |
| `accent-foreground` на `accent` | 11.6:1 | 10.4:1 | ≥ 4.5 |
| `destructive` на `background` | 6.4:1 | 6.9:1 | ≥ 4.5 |
| `destructive-foreground` на `destructive` | 6.3:1 | 6.8:1 | ≥ 4.5 |
| `status-free-foreground` на `status-free` | 8.0:1 | 8.6:1 | ≥ 4.5 |
| `status-held-foreground` на `status-held` | 8.5:1 | 8.8:1 | ≥ 4.5 |
| `status-confirmed-foreground` на `status-confirmed` | 8.7:1 | 9.1:1 | ≥ 4.5 |
| `status-expired-foreground` на `status-expired` | 7.9:1 | 8.5:1 | ≥ 4.5 |
| `status-past-foreground` на `status-past` | 6.3:1 | 6.6:1 | ≥ 4.5 |
| `input` на `background` | 4.1:1 | 5.1:1 | ≥ 3 |
| `input` на `card` | 4.2:1 | 4.6:1 | ≥ 3 |
| `ring` на `background` | 5.5:1 | 9.5:1 | ≥ 3 |
| `ring` на `card` | 5.8:1 | 8.6:1 | ≥ 3 |

## 3. Типографіка

Шрифт — Geist (`--font-sans`, підключено через `next/font`), час і дати — Geist Mono (`--font-mono`). Мова інтерфейсу — англійська. Рядок тексту не ширший за 65 знаків.

| Роль | Клас | Де |
|---|---|---|
| Заголовок сторінки | `text-2xl font-semibold` | один `h1` на сторінку |
| Заголовок розділу | `text-lg font-semibold` | `h2` усередині сторінки |
| Основний текст | `text-sm` | клітинки таблиць, значення полів |
| Підпис, заголовок колонки, текст кнопки | `text-sm font-medium` | `Label`, `th`, `Button` |
| Допоміжний текст | `text-sm text-muted-foreground` | пояснення, порожній стан |
| Бейдж, підказка | `text-xs font-medium` | `Badge` |
| Час і дата | `font-mono text-sm font-medium` | `09:00–10:00`, `2026-12-15 10:00` |

## 4. Відступи й радіуси

Відступи лише зі шкали Tailwind: `gap-2` (8 px) усередині бейджа й кнопки, `gap-2` (8 px) між підписом і полем, `gap-3` (12 px) між елементами рядка форми, `gap-4` (16 px) між полями форми, `gap-6` (24 px) між розділами сторінки, `px-3 py-2.5` — клітинка таблиці, `py-8` — порожній стан; `p-4` — для картки, коли вона з'явиться. Ширина контенту `max-w-4xl`, поля сторінки `px-6`.

Радіуси задано явно в `globals.css`: `--radius-sm: 4px` (`rounded-sm` — бейдж), `--radius-lg: 8px` (`rounded-lg` — кнопки, поля, таблиці, повідомлення, картки), `--radius-xl: 12px` (`rounded-xl` — діалоги й меню, коли з'являться). Поверхні відокремлює межа `border`, а не тінь; тінь лише в меню й діалогів (`shadow-md`).

## 5. Компоненти й варіанти

Лише з `@/components/ui`. Новий компонент — `npx shadcn@4.22.1 add <назва>`; змінюємо їх у цій теці, а не сторінках.

| Компонент | Варіанти | Правило |
|---|---|---|
| `Button` | `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`; розміри `default`, `sm` | `default` — одна основна дія на екран (`Hold`, `Confirm`, `Create client`, `Sign in`); `outline` чи `secondary` — друга дія; `ghost` — навігація; `destructive` — лише для видалення |
| `Input` + `Label` | — | у кожного поля `Label` з `htmlFor`; placeholder — не замість підпису. Помилку дії показує `Alert` над вмістом; у формі картки клієнта текст відмови дослівний і один (з AC), тож його показує `Alert` над формою, а поля, яких він стосується, мають `aria-invalid` і `aria-describedby` на цей `Alert`; окремий текст під полем — коли PM дасть окремі тексти (Sofiia-pm/therapy-scheduling-spec#21) |
| `NativeSelect` | — | рідний `<select>` у стилі поля (працює без JS у формах); перший пункт порожній і недоступний (`Choose a client`), інакше `required` нічого не вимагає |
| `Card` | — | картка клієнта (`ClientCard`): `Card` → `CardHeader` + `CardTitle` → `CardContent`; межа `border`, радіус `rounded-lg`; не вкладати картку в картку. Частин `footer`, `action`, `description` немає: додаємо разом із першим екраном, що їх потребує |
| `Table` | — | список даних; `caption` обов'язковий (може бути `sr-only`); для нуля рядків — `EmptyState` замість таблиці. Анімовані компоненти (`dialog`, `select`) потребують `tw-animate-css` і `shadcn/tailwind.css` — додати разом із компонентом |
| `Badge` / `StatusBadge` | `free`, `held`, `confirmed`, `expired`, `past` | статус слота чи утримання — `StatusBadge status={…}` (слово з бази, знак і колір з варіанта); інших статусів без токена в розділі 2 немає |
| `Alert` | `default` (інформація), `destructive` (помилка) | текст дослівно з AC; роль за варіантом (`destructive` — `alert`, `default` — `status`); повідомлення після redirect (`AppShell`) — завжди `alert`, бо в новому документі `status` не озвучується |
| `EmptyState` | — | заголовок (що порожньо) і одне речення, що далі; проєктний компонент `@/components/ui/empty-state` |

## 6. Стани

Тексти — дослівно з вимог PM (`MESSAGES` у `src/lib/messages.ts`).

| Стан | Як виглядає | Приклад тексту |
|---|---|---|
| Порожній список | `EmptyState` (замість таблиці чи списку) | «No holds yet.», «No clients yet.», «No slots this week.» |
| Немає вільного слота у дні | абзац `text-muted-foreground` над списком слотів (слоти лишаються) | «No free slots on this day.» |
| Помилка дії | `Alert` (destructive) над вмістом | «This slot is no longer available.» |
| Успіх | `Alert` (default) над вмістом | «Slot held.», «Hold confirmed.» |
| Відмова в доступі | повідомлення на головній без даних | «Only schedulers and admins can confirm holds.» |
| Помилка поля | межа `border-destructive`, текст `text-destructive` під полем | «Enter the client's name and a valid email.» |
| Вимкнена дія | `disabled` (прозорість 50 %) | — |
| Помилка сторінки | `error.tsx` з `Alert` і кнопкою `Try again` | «Something went wrong. Try again.» |

## 7. Доступність — мінімум

- `Label` у кожного поля; помилка поля пов'язана з полем (`aria-describedby`).
- Видимий фокус: `ring` (контур 2 px) на кожному інтерактивному елементі; Tab проходить форму по порядку.
- Контраст — таблиця в розділі 2, перевірена в обох темах.
- Статус ніколи не лише кольором: слово й знак (порожнє коло — `Free`, півколо — `Held`, заповнене коло — `Confirmed`, ромб — `Expired`, риска — `Past`).
- Спершу семантичний HTML (`<button>`, `<table>`, `<label>`); `aria-*` — там, де HTML бракує.

## 8. Do / Don't

| ✅ Робимо | ❌ Не робимо |
|---|---|
| `bg-primary text-primary-foreground` | `bg-zinc-900 text-white`, `bg-[#0f6b6e]`, `style={{ color: "#…" }}` |
| компонент `Button` з потрібним варіантом | власний `<button className="…">` у сторінці |
| помилка: `Alert` / `text-destructive` з підказкою, що робити | червоний як акцент чи статус |
| статус: `Badge` зі словом і знаком | кольорова крапка без підпису |
| одна основна (`default`) дія на екран; у рядку списку — одна на рядок (`Hold`, `Confirm`) | дві однаково яскраві основні дії поруч у формі чи в шапці |
| новий токен через розділ 9 | новий колір «лише для цієї сторінки» |
| текст кнопки — дієслово дії (`Hold`) | `Submit`, `OK` |

## 9. Як додати токен

1. Опишіть токен у таблиці розділу 2: для чого, значення в обох темах, контраст.
2. `src/app/globals.css`: `--<назва>` у `:root` і в `@media (prefers-color-scheme: dark)`.
3. `--color-<назва>: var(--<назва>);` у `@theme inline` → з'являються класи `bg-<назва>`, `text-<назва>`, `border-<назва>`.
4. `npm run check:design` і знімок сторінки у світлій і темній темі.

## 10. Перевірка

- `npm run check:design` — жодного hex, довільного кольору, сирої палітри чи кольору в inline style поза `src/components/ui` і `globals.css`. CI: `.github/workflows/architecture.yml`, job «Дизайн-система: лише токени».
- Виняток — коментар `design-ok: <причина>` у тому самому рядку; кожен виняток — з реальною причиною.
- Каталог компонентів: `npm run storybook` (історії в `src/**/*.stories.tsx`, перевірка доступності axe в панелі), у CI — `.github/workflows/storybook.yml`.
- Візуально: знімки ключових сторінок у світлій і темній темі (`docs/img/ws7-before-*` — до змін, `docs/img/ws7-after-*` — після), Tab по формі, контраст.
