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

WHEN планувальник чи адміністратор створює картку з типом «Child», ім'ям, датою народження, мовою сеансів, ім'ям опікуна й email опікуна, the system SHALL створити картку з даними дитини й опікуна, показувати email опікуна біля дитини і дозволяти знайти дитину під час утримання слоту за email опікуна.

#### Scenario: AC-CARD-02 Картка дитини з опікуном

- **GIVEN** опікуна з email guardian7@example.test ще не вказано в жодній картці
- **WHEN** scheduler1 створює картку з типом «Child», ім'ям «Client Seven», датою народження 2015-03-02, мовою сеансів «Spanish», ім'ям опікуна «Guardian Seven» і email опікуна guardian7@example.test
- **THEN** картку створено, у ній показано дані дитини й опікуна
- **AND** під час утримання слоту client7 можна знайти за email опікуна guardian7@example.test
- **AND** біля client7 показано email опікуна

### Requirement: Дані опікуна обов'язкові для дитини

IF в картці з типом «Child» ім'я або email опікуна порожнє, THEN the system SHALL не створювати картку, показати «Enter the guardian's name and a valid email.» і лишити введені дані у формі.

#### Scenario: AC-CARD-03 Дитина без даних опікуна

- **GIVEN** scheduler1 заповнює картку з типом «Child», ім'ям «Client Eight», датою народження 2016-01-10 і мовою «English»
- **WHEN** ім'я або email опікуна залишено порожнім і scheduler1 зберігає картку
- **THEN** картку не створено
- **AND** scheduler1 бачить повідомлення «Enter the guardian's name and a valid email.»
- **AND** усі введені дані лишаються у формі

### Requirement: Терапевт бачить картки лише своїх клієнтів

WHEN терапевт відкриває список своїх клієнтів, the system SHALL показати картки лише тих клієнтів, у кого з цим терапевтом є утримання зі статусом «Held», слот якого ще не почався, або сеанс зі статусом «Confirmed» (зокрема минулий), з усіма даними анкети (для дитини — з даними опікуна).

#### Scenario: AC-CARD-04 Список своїх клієнтів терапевта

- **GIVEN** зараз 2026-11-02 12:00, client6 має утримання зі статусом «Held» у therapist1 на 2026-11-05 о 10:00, client7 — сеанс зі статусом «Confirmed» у therapist1 2026-11-04 о 10:00, а client9 — утримання зі статусом «Held» у therapist2 на 2026-11-05 об 11:00
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

IF терапевт відкриває форму нової картки клієнта, THEN the system SHALL не показувати форму, одразу показати «Only schedulers and admins can create client cards.» і не створювати картку, а спробу терапевта створити картку в обхід форми the system SHALL відхилити без створення картки.

#### Scenario: AC-CARD-06 Терапевт пробує створити картку

- **GIVEN** therapist1 увійшов у застосунок
- **WHEN** він відкриває форму нової картки клієнта за прямим посиланням
- **THEN** форму не показано
- **AND** therapist1 одразу бачить повідомлення «Only schedulers and admins can create client cards.»
- **AND** кількість карток клієнтів не змінилася

### Requirement: Планувальник і адміністратор бачать усі картки

WHEN планувальник чи адміністратор відкриває список клієнтів, the system SHALL показати картки всіх клієнтів, а в картці дитини — дані опікуна.

#### Scenario: AC-CARD-10 Планувальник і адміністратор бачать усіх

- **GIVEN** існують картки client6, client7 і client9
- **WHEN** scheduler2 або admin1 відкриває список клієнтів
- **THEN** кожен із них бачить усі три картки
- **AND** в картці client7 показано дані опікуна

### Requirement: Усі помилки форми картки показуються одразу

IF в формі картки клієнта кілька полів некоректні, THEN the system SHALL не створювати картку й одразу показати біля кожного такого поля його повідомлення, лишивши введені дані у формі: тип не вибрано — «Select a client type.»; ім'я дитини — «Enter the client's name.»; дата порожня або пізніша за сьогодні (сьогоднішня коректна) — «Enter a date of birth that is not in the future.»; мову не вибрано — «Select a session language.»; для дорослого й опікуна — повідомлення AC-HOLD-11 і AC-CARD-03.

#### Scenario: AC-CARD-12 Кілька помилок у формі картки

- **GIVEN** сьогодні 2026-11-03
- **WHEN** scheduler1 створює картку з типом «Child», порожнім ім'ям, датою народження 2026-11-04, без мови сеансів, з ім'ям опікуна «Guardian Eight» і email опікуна guardian8@example.test
- **THEN** картку не створено
- **AND** scheduler1 одразу бачить три повідомлення біля відповідних полів — «Enter the client's name.», «Enter a date of birth that is not in the future.» і «Select a session language.»
- **AND** всі введені дані лишаються у формі

### Requirement: Дублікат картки дитини

IF вже є картка дитини з тим самим ім'ям (без урахування великих і малих літер та пробілів на початку й у кінці), датою народження й email опікуна, THEN the system SHALL не створювати картку, показати «A client with these details already exists.» і лишити введені дані у формі.

#### Scenario: AC-CARD-13 Дублікат картки дитини

- **GIVEN** є картка client7 з типом «Child», ім'ям «Client Seven», датою народження 2015-03-02 і email опікуна guardian7@example.test
- **WHEN** scheduler2 створює картку з типом «Child», ім'ям « client seven », датою народження 2015-03-02, мовою сеансів «English», ім'ям опікуна «Guardian Seven» і email опікуна guardian7@example.test
- **THEN** другу картку не створено
- **AND** scheduler2 бачить повідомлення «A client with these details already exists.»
- **AND** введені дані лишаються у формі

### Requirement: Клієнт лишається своїм до початку слоту утримання

WHEN настає момент початку слоту утримання зі статусом «Held», the system SHALL перестати вважати клієнта своїм для цього терапевта (якщо в нього немає іншого утримання «Held», слот якого ще не почався, чи сеансу «Confirmed») і відмовити терапевту в картці за прямим посиланням, а клієнта із сеансом «Confirmed» the system SHALL вважати своїм без обмеження в часі.

#### Scenario: AC-CARD-14 Клієнт перестає бути своїм з початку слоту

- **GIVEN** слот therapist1 2026-11-03 о 10:00 утримано за client6 2026-11-02 о 14:30 зі статусом «Held», client7 мав сеанс зі статусом «Confirmed» у therapist1 2026-11-02 о 10:00, і інших утримань чи сеансів client6 і client7 з therapist1 немає
- **WHEN** therapist1 відкриває список своїх клієнтів 2026-11-03 о 09:59, а потім о 10:00 або пізніше
- **THEN** о 09:59 він бачить картки client6 і client7, а з 10:00 — лише картку client7
- **AND** за прямим посиланням на картку client6 therapist1 бачить повідомлення «You don't have access to this client.» і жодних даних client6

### Requirement: Порожній список клієнтів планувальника й адміністратора

IF у практиці ще немає жодної картки клієнта, THEN the system SHALL показати планувальнику й адміністратору замість списку «No clients yet. Create a client card from an intake form.» і лишити доступною форму нової картки.

#### Scenario: AC-CARD-15 Порожній список для планувальника й адміністратора

- **GIVEN** у практиці ще немає жодної картки клієнта
- **WHEN** scheduler1 або admin1 відкриває список клієнтів
- **THEN** замість списку він бачить повідомлення «No clients yet. Create a client card from an intake form.»
- **AND** форма нової картки доступна, як завжди

### Requirement: Картки, якої не існує

IF картки клієнта, на яку веде посилання, не існує, THEN the system SHALL показати планувальнику й адміністратору «This client card doesn't exist.», терапевту — «You don't have access to this client.» і не показувати жодних даних клієнтів.

#### Scenario: AC-CARD-16 Посилання на картку, якої немає

- **GIVEN** картки клієнта, на яку веде посилання, не існує
- **WHEN** scheduler1, а потім therapist1 відкриває це посилання
- **THEN** scheduler1 бачить повідомлення «This client card doesn't exist.»
- **AND** therapist1 — «You don't have access to this client.»
- **AND** жоден із них не бачить жодних даних клієнтів
