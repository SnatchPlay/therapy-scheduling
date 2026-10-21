# План реалізації: відповіді PM на питання до вимог (зріз 1, друга частина)

## Why

PM відповіла на питання Sofiia-pm/therapy-scheduling-spec#6–#9 і додала AC-HOLD-25…36 (знімок вимог 2026-10-21,
шапка `docs/conformance.md`; специфікація — зміна `answer-slot-hold`, у `archive/`). Перша частина зрізу (план
`impl-slot-hold`, AC-HOLD-01…24) уже на проді; тут — решта 12 AC і розбіжності з тим, що вже збудовано.

## What Changes

Зміна плану без нових вимог (`skip_specs: true`): `design.md` — рішення з AC ID, `tasks.md` — три вертикальні задачі,
кожна — окремий PR «Реалізація».

- `slot-holds`: AC-HOLD-25, AC-HOLD-26, AC-HOLD-27, AC-HOLD-28, AC-HOLD-29, AC-HOLD-30, AC-HOLD-31, AC-HOLD-32,
  AC-HOLD-33, AC-HOLD-36.
- `client-cards`: AC-HOLD-34, AC-HOLD-35 (поведінка вже є з задачі 1 — додаємо тести з цими ID).

## Capabilities

### New Capabilities

—

### Modified Capabilities

—

## Users & roles

Без змін: матриця прав `requirements/product.md`.

## Non-goals

Показ, хто створив і хто підтвердив утримання (PM: Sofiia-pm/therapy-scheduling-spec#7, наступні зрізи); перетин
слотів одного терапевта між собою — слоти сидом по годині без перетину, у вимозі немає AC.

## Assumptions

Ті самі, що в зміні `answer-slot-hold`; власних нових припущень немає.

## Open questions

Немає.
