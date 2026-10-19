# client-cards Specification

## Purpose
Картка клієнта, за яким планувальник утримує слот: у зрізі 1 — лише ім'я та email, які вводить планувальник або
адміністратор.

## Requirements

### Requirement: Створення картки клієнта

WHEN планувальник або адміністратор створює клієнта з ім'ям і email, якого ще немає, the system SHALL створити картку клієнта, яку можна вибрати під час утримання слоту.

#### Scenario: AC-HOLD-10 Створення нового клієнта

- **GIVEN** клієнта з email client3@example.test ще немає
- **WHEN** планувальник створює клієнта з іменем «Client Three» і email client3@example.test
- **THEN** картку клієнта створено
- **AND** його можна вибрати під час утримання слоту

### Requirement: Некоректні ім'я чи email

IF ім'я клієнта порожнє або email без знака @, THEN the system SHALL не створювати клієнта й показати «Enter the client's name and a valid email.».

#### Scenario: AC-HOLD-11 Порожнє ім'я

- **GIVEN** планувальник створює клієнта
- **WHEN** ім'я залишено порожнім, а email — client3@example.test
- **THEN** клієнта не створено
- **AND** планувальник бачить повідомлення «Enter the client's name and a valid email.»

#### Scenario: AC-HOLD-15 Email без знака @

- **GIVEN** планувальник створює клієнта
- **WHEN** ім'я — «Client Three», а email — «client3example.test» (без знака @)
- **THEN** клієнта не створено
- **AND** планувальник бачить повідомлення «Enter the client's name and a valid email.»

### Requirement: Унікальний email клієнта

IF клієнт із таким email уже існує, THEN the system SHALL не створювати клієнта й показати «A client with this email already exists.».

#### Scenario: AC-HOLD-16 Клієнт із таким email уже існує

- **GIVEN** клієнт з email client1@example.test уже існує
- **WHEN** планувальник створює ще одного клієнта з email client1@example.test
- **THEN** клієнта не створено
- **AND** планувальник бачить повідомлення «A client with this email already exists.»
