# client-cards Specification

## Purpose
Картка клієнта, за яким планувальник утримує слот: ім'я, email, а з анкети — тип (дорослий чи дитина з опікуном), дата
народження й мова сеансів; планувальник і адміністратор бачать усі картки, терапевт — лише своїх клієнтів.

## Requirements

### Requirement: Створення картки клієнта

WHEN планувальник або адміністратор створює клієнта з ім'ям і email, якого ще немає, the system SHALL створити картку клієнта, яку можна вибрати під час утримання слоту.

#### Scenario: AC-HOLD-10 Створення нового клієнта

- **GIVEN** клієнта з email client3@example.test ще немає
- **WHEN** планувальник створює клієнта з іменем «Client Three» і email client3@example.test
- **THEN** картку клієнта створено
- **AND** його можна вибрати під час утримання слоту

### Requirement: Некоректні ім'я чи email

IF ім'я клієнта порожнє (ім'я лише з пробілів вважається порожнім) або email некоректний (після прибирання пробілів на початку й у кінці він не містить рівно одного «@», має порожню частину до чи після «@», не має крапки в частині після «@» або має пробіл усередині), THEN the system SHALL не створювати клієнта й показати «Enter the client's name and a valid email.»; ім'я клієнта the system SHALL зберігати без пробілів на початку й у кінці.

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

#### Scenario: AC-HOLD-39 Інші некоректні email

- **GIVEN** клієнта з таким email ще немає
- **WHEN** планувальник створює клієнта «Client Three» з email «client3@example» (без крапки після «@»), «client3@@example.test» (два «@»), «@example.test» (порожня частина до «@») або «client 3@example.test» (пробіл усередині)
- **THEN** в кожному випадку клієнта не створено
- **AND** планувальник бачить повідомлення «Enter the client's name and a valid email.»

#### Scenario: AC-HOLD-41 Ім'я з пробілами

- **GIVEN** клієнтів з email client4@example.test і client5@example.test ще немає
- **WHEN** планувальник створює клієнта з іменем «   » (лише пробіли) і email client5@example.test, а потім клієнта з іменем « Client Four » і email client4@example.test
- **THEN** першого клієнта не створено, і планувальник бачить повідомлення «Enter the client's name and a valid email.»
- **AND** другого створено, і в картці його ім'я показано як «Client Four»

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

### Requirement: Email клієнта зберігається нормалізованим

WHEN планувальник створює клієнта, the system SHALL зберегти email малими літерами без пробілів на початку й у кінці і показувати його так у картці клієнта та під час утримання.

#### Scenario: AC-HOLD-35 Нормалізація email

- **GIVEN** клієнта з email client3@example.test ще немає
- **WHEN** планувальник створює клієнта «Client Three» з email « Client3@Example.TEST »
- **THEN** клієнта створено
- **AND** у картці клієнта та під час утримання його email показано як client3@example.test

### Requirement: Картка дорослого клієнта з анкети

WHEN планувальник чи адміністратор створює картку з типом «Adult», ім'ям, email клієнта, датою народження (не пізніше за сьогодні) і мовою сеансів («English» або «Spanish»), the system SHALL створити картку з усіма цими даними, яку можна вибрати під час утримання слоту.

#### Scenario: AC-CARD-01 Картка дорослого

- **GIVEN** клієнта з email client6@example.test ще немає
- **WHEN** scheduler1 створює картку з типом «Adult», ім'ям «Client Six», email client6@example.test, датою народження 1990-05-14 і мовою сеансів «English»
- **THEN** картку створено, у ній показано всі ці дані
- **AND** client6 можна вибрати під час утримання слоту

### Requirement: Картка дитини з опікуном

WHEN планувальник чи адміністратор створює картку з типом «Child», ім'ям, датою народження, мовою сеансів, ім'ям опікуна й email опікуна, the system SHALL створити картку з даними дитини й опікуна і показувати email опікуна біля дитини під час утримання слоту.

#### Scenario: AC-CARD-02 Картка дитини з опікуном

- **GIVEN** опікуна з email guardian7@example.test ще не вказано в жодній картці
- **WHEN** scheduler1 створює картку з типом «Child», ім'ям «Client Seven», датою народження 2015-03-02, мовою сеансів «Spanish», ім'ям опікуна «Guardian Seven» і email опікуна guardian7@example.test
- **THEN** картку створено, у ній показано дані дитини й опікуна
- **AND** під час утримання слоту біля client7 показано email опікуна

### Requirement: Дані опікуна обов'язкові для дитини

IF в картці з типом «Child» ім'я або email опікуна порожнє, THEN the system SHALL не створювати картку, показати «Enter the guardian's name and a valid email.» і лишити введені дані у формі.

#### Scenario: AC-CARD-03 Дитина без даних опікуна

- **GIVEN** scheduler1 заповнює картку з типом «Child», ім'ям «Client Eight», датою народження 2016-01-10 і мовою «English»
- **WHEN** ім'я або email опікуна залишено порожнім і scheduler1 зберігає картку
- **THEN** картку не створено
- **AND** scheduler1 бачить повідомлення «Enter the guardian's name and a valid email.»
- **AND** усі введені дані лишаються у формі

### Requirement: Терапевт бачить картки лише своїх клієнтів

WHEN терапевт відкриває список своїх клієнтів, the system SHALL показати картки лише тих клієнтів, у кого з цим терапевтом є утримання зі статусом «Held» або сеанс зі статусом «Confirmed», з усіма даними анкети (для дитини — з даними опікуна).

#### Scenario: AC-CARD-04 Список своїх клієнтів терапевта

- **GIVEN** client6 має утримання зі статусом «Held» у therapist1, client7 — сеанс зі статусом «Confirmed» у therapist1, а client9 — утримання зі статусом «Held» у therapist2
- **WHEN** therapist1 відкриває список своїх клієнтів
- **THEN** він бачить картки client6 і client7 з усіма даними анкети (для client7 — з даними опікуна)
- **AND** не бачить client9

### Requirement: Порожній список клієнтів терапевта

IF терапевт не має жодного утримання зі статусом «Held» і жодного сеансу зі статусом «Confirmed», THEN the system SHALL показати йому в списку клієнтів «No clients yet. Clients appear here when a scheduler holds a slot with you.» і жодної картки.

#### Scenario: AC-CARD-09 Терапевт без клієнтів

- **GIVEN** therapist2 не має жодного утримання зі статусом «Held» і жодного сеансу зі статусом «Confirmed»
- **WHEN** therapist2 відкриває список своїх клієнтів
- **THEN** він бачить повідомлення «No clients yet. Clients appear here when a scheduler holds a slot with you.»
- **AND** жодної картки

### Requirement: Прострочене утримання не робить клієнта своїм

IF в клієнта з терапевтом є лише утримання зі статусом «Expired», THEN the system SHALL не показувати клієнта в списку терапевта й відмовити терапевту в доступі до картки за прямим посиланням.

#### Scenario: AC-CARD-08 Прострочене утримання

- **GIVEN** утримання client6 у therapist1 має статус «Expired», і інших утримань чи сеансів client6 з therapist1 немає
- **WHEN** therapist1 відкриває список своїх клієнтів, а потім картку client6 за прямим посиланням
- **THEN** client6 у списку немає
- **AND** за посиланням therapist1 бачить повідомлення «You don't have access to this client.» і жодних даних client6

### Requirement: Терапевт не відкриває картку чужого клієнта

IF терапевт відкриває картку клієнта, який не є його клієнтом, THEN the system SHALL показати «You don't have access to this client.», не показувати даних клієнта й не змінювати картку.

#### Scenario: AC-CARD-05 Чужа картка за прямим посиланням

- **GIVEN** client9 — свій клієнт лише для therapist2
- **WHEN** therapist1 відкриває картку client9 за прямим посиланням
- **THEN** therapist1 бачить повідомлення «You don't have access to this client.»
- **AND** жодних даних client9 не показано, і картка client9 не змінилася

### Requirement: Терапевт не створює картки клієнтів

IF терапевт пробує створити картку клієнта, THEN the system SHALL не створювати картку й показати «Only schedulers and admins can create client cards.».

#### Scenario: AC-CARD-06 Терапевт пробує створити картку

- **GIVEN** therapist1 увійшов у застосунок
- **WHEN** він відкриває форму нової картки клієнта за прямим посиланням і пробує створити картку
- **THEN** картку не створено
- **AND** therapist1 бачить повідомлення «Only schedulers and admins can create client cards.»
- **AND** кількість карток клієнтів не змінилася

### Requirement: Планувальник і адміністратор бачать усі картки

WHEN планувальник чи адміністратор відкриває список клієнтів, the system SHALL показати картки всіх клієнтів, а в картці дитини — дані опікуна.

#### Scenario: AC-CARD-10 Планувальник і адміністратор бачать усіх

- **GIVEN** існують картки client6, client7 і client9
- **WHEN** scheduler2 або admin1 відкриває список клієнтів
- **THEN** кожен із них бачить усі три картки
- **AND** в картці client7 показано дані опікуна
