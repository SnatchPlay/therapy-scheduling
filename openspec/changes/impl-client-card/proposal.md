# План реалізації: картка клієнта з анкети й доступ терапевта до своїх клієнтів (WS7, зріз 2)

## Why

Реалізуємо зріз 2: специфікація — зміна `add-client-card` (у `archive/`), вимога PM — Sofiia-pm/therapy-scheduling-spec#19 і
нові AC зрізу 1 (знімок вимог 2026-10-25, шапка `docs/conformance.md`). Головне — доступ: терапевт бачить лише
власних клієнтів, і це правило мусить діяти для прямого запиту до Data API, а не лише в застосунку.

## What Changes

Зміна плану без нових вимог (`skip_specs: true`): `design.md` — рішення, `tasks.md` — чотири вертикальні задачі, кожна —
окремий PR «Реалізація».

- `client-cards`: AC-CARD-01, 02, 03, 04, 05, 06, 08, 09, 10; AC-HOLD-39, AC-HOLD-41.
- `app-access`: AC-CARD-07, AC-CARD-11.
- `slot-holds`: AC-HOLD-37, AC-HOLD-38, AC-HOLD-40, AC-HOLD-42.

## Capabilities

### New Capabilities

—

### Modified Capabilities

—

## Users & roles

Без змін: матриця прав `requirements/product.md`; новий стан — користувач без ролі (AC-CARD-11).

## Non-goals

Редагування й архівування картки, пошук і фільтри, керування ролями в застосунку (як у специфікації).

## Assumptions

Ті самі, що в зміні `add-client-card`; власні — у `design.md` (Р12–Р16), питання до PM Q1–Q4 у `docs/spec-reading.md`.

## Open questions

Q1–Q4 з `docs/spec-reading.md` (зріз 2) ще без відповіді PM; рішення за замовчуванням описані в `design.md`.
