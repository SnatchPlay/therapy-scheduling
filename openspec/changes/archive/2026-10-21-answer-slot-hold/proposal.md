# Пропозиція: відповіді PM на питання до вимог (AC-HOLD-25…36)

## Why

PM відповіла на питання розробників і змінила вимогу Sofiia-pm/therapy-scheduling-spec#2 (знімок
`requirements/2-planuvalnyk-utrymuie-slot-terapevta.md`, 2026-10-21). Рядки журналу змін PM, дослівно:

- «2026-10-20 — додано AC-HOLD-25 і AC-HOLD-26: утримання й сеанси одного клієнта не можуть перетинатися в часі, прострочені не враховуються» — Sofiia-pm/therapy-scheduling-spec#6
- «2026-10-20 — додано AC-HOLD-27: будь-який планувальник чи адміністратор може підтвердити будь-яке утримання» — Sofiia-pm/therapy-scheduling-spec#7
- «2026-10-20 — додано AC-HOLD-28 і AC-HOLD-29: прострочене утримання видно планувальнику лише до початку слоту» — Sofiia-pm/therapy-scheduling-spec#8
- «2026-10-20 — додано AC-HOLD-30 і AC-HOLD-31: терапевт бачить у розкладі поточний тиждень (понеділок–неділя) з усіма своїми слотами й статусами і може перемикати тижні» — Sofiia-pm/therapy-scheduling-spec#9
- «2026-10-20 — додано AC-HOLD-32 і AC-HOLD-33 та припущення про статус «Past»» — Sofiia-pm/therapy-scheduling-spec#10
- «2026-10-20 — додано AC-HOLD-34 і AC-HOLD-35, уточнено припущення про email» — Sofiia-pm/therapy-scheduling-spec#11
- «2026-10-20 — додано AC-HOLD-36: повторне чи одночасне підтвердження відхиляється» — Sofiia-pm/therapy-scheduling-spec#12

Наші власні питання #6–#9 PM закрила відповідями; #10–#12 поставив інший учасник команди.

## What Changes

- MODIFIED `slot-holds`: «Статуси слотів дня» (+ AC-HOLD-32, статус «Past»), «День без вільних слотів» (+ AC-HOLD-33),
  «Прострочення утримання» (+ AC-HOLD-28, 29: видно до початку слоту), «Розклад терапевта» (+ AC-HOLD-30, 31: тиждень
  пн–нд з усіма слотами; AC-HOLD-09 і 21 — без змін).
- ADDED `slot-holds`: «Утримання й сеанси клієнта не перетинаються» (AC-HOLD-25, 26), «Будь-який планувальник
  підтверджує будь-яке утримання» (AC-HOLD-27), «Повторне підтвердження відхиляється» (AC-HOLD-36).
- MODIFIED `client-cards`: «Унікальний email клієнта» (+ AC-HOLD-34); ADDED «Email клієнта зберігається нормалізованим»
  (AC-HOLD-35).

## Capabilities

### New Capabilities

—

### Modified Capabilities

- `slot-holds`
- `client-cards`

## Users & roles

Без змін: матриця прав `requirements/product.md`.

## Non-goals

Показ, хто створив і хто підтвердив утримання, — на наступні зрізи (PM, Sofiia-pm/therapy-scheduling-spec#7).

## Assumptions

Тиждень — з понеділка по неділю в часовому поясі практики (America/Los_Angeles); слот без активного утримання чи
сеансу, що вже почався, — «Past»; email нормалізується (маленькі літери, без пробілів по краях). Усе — припущення PM
у вимозі.

## Open questions

Немає відкритих питань до PM у цій зміні.
