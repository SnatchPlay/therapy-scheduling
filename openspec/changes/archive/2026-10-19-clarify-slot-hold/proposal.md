# Пропозиція: уточнення AC-HOLD-18 і новий AC-HOLD-24 (день без вільних слотів)

## Why

PM відповіла на питання Sofiia-pm/therapy-scheduling-spec#4 (варіант A) і змінила вимогу
Sofiia-pm/therapy-scheduling-spec#2. Рядок журналу змін PM: «2026-10-19 — змінено AC-HOLD-18: якщо вільних слотів
немає, планувальник бачить повідомлення «No free slots on this day.» і всі слоти дня з їхніми статусами; додано
AC-HOLD-24: день без жодного слоту — лише повідомлення». Знімок: `requirements/2-planuvalnyk-utrymuie-slot-terapevta.md`,
2026-10-19 (друга синхронізація).

## What Changes

- MODIFIED «День без вільних слотів»: AC-HOLD-18 — під повідомленням «No free slots on this day.» планувальник бачить
  усі слоти дня з їхніми статусами (приклад PM: 10:00 «Held», 11:00 «Confirmed»).
- ADDED у ту саму вимогу: AC-HOLD-24 — день без жодного слоту: лише повідомлення й жодного слоту.

## Capabilities

### New Capabilities

—

### Modified Capabilities

- `slot-holds`: вимога «День без вільних слотів».

## Users & roles

Без змін: `scheduler` і `admin` переглядають слоти дня (матриця прав `requirements/product.md`).

## Non-goals

Без змін відносно `add-slot-hold`.

## Assumptions

Без змін відносно `add-slot-hold`.

## Open questions

Без змін: Sofiia-pm/therapy-scheduling-spec#6, #7, #8, #9 чекають відповіді PM.
