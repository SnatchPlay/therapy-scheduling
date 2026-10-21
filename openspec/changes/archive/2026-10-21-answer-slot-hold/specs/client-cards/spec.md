# Дельта: client-cards

## MODIFIED Requirements

### Requirement: Унікальний email клієнта

IF клієнт із таким email уже існує (без урахування великих і малих літер та пробілів на початку й у кінці), THEN the system SHALL не створювати клієнта й показати «A client with this email already exists.».

#### Scenario: AC-HOLD-16 Клієнт із таким email уже існує

- **GIVEN** клієнт з email client1@example.test уже існує
- **WHEN** планувальник створює ще одного клієнта з email client1@example.test
- **THEN** клієнта не створено
- **AND** планувальник бачить повідомлення «A client with this email already exists.»

#### Scenario: AC-HOLD-34 Той самий email з іншим регістром і пробілами

- **GIVEN** клієнт з email client1@example.test уже існує
- **WHEN** планувальник створює клієнта «Client One» з email « Client1@Example.TEST » (з великими літерами й пробілами на початку та в кінці)
- **THEN** клієнта не створено
- **AND** планувальник бачить повідомлення «A client with this email already exists.»

## ADDED Requirements

### Requirement: Email клієнта зберігається нормалізованим

WHEN планувальник створює клієнта, the system SHALL зберегти email малими літерами без пробілів на початку й у кінці і показувати його так у картці клієнта та під час утримання.

#### Scenario: AC-HOLD-35 Нормалізація email

- **GIVEN** клієнта з email client3@example.test ще немає
- **WHEN** планувальник створює клієнта «Client Three» з email « Client3@Example.TEST »
- **THEN** клієнта створено
- **AND** у картці клієнта та під час утримання його email показано як client3@example.test
