// Мутанти для scripts/mutation-check.mjs (npm run mutation:sql). Мутант = одне правило з AC, навмисно зламане.
// Формат — koldovsky/2026-quitcode-08-quality-hw/materials/testing/scripts/mutants.mjs. Поля:
//   id, kind ("sql" | "ts"), ac (який AC це правило доводить), what (що зламано — людською мовою);
//   file — що мутуємо; tests — файли тестів, які мають довести правило (саме їх і запускаємо);
//   find — рядок або RegExp, що трапляється у файлі РІВНО один раз; replace — заміна (буквально);
//   expect: "survive" + reason — лише для еквівалентного мутанта з посиланням на те, що робить його еквівалентним.
// Політику послаблюємо до true, а не видаляємо: без політики RLS забороняє все, і тест відмови лишився б зеленим.
// Мутант на правило, що живе в SQL, — тут; новий AC із відмовою в SQL — новий мутант.
const PROFILES = "supabase/migrations/20261012000000_profiles_and_roles.sql";
const SLOTS_AND_HOLDS = "supabase/migrations/20261019143036_slots_and_holds.sql";
const CLIENT_CARD = "supabase/migrations/20261026100000_client_card.sql";
const OWN_CLIENT = "supabase/migrations/20261103100000_own_client_until_start.sql";
const INSURANCE = "supabase/migrations/20261108062344_insurance_status.sql";
const INSURANCE_DB = "tests/db/insurance-status-db.test.ts";
const PROFILES_DB = "tests/db/profiles-db.test.ts";
const CARD_DB = "tests/db/client-card-db.test.ts";
const HOLD_DB = ["tests/db/holds-db.test.ts", "tests/db/hold-list-db.test.ts", "tests/db/schedule-db.test.ts"];
const CLIENT_PAGE = "src/app/clients/[id]/page.tsx";
const CLIENT_PAGE_TEST = "src/app/clients/[id]/page.test.tsx";
const CLIENTS_ACTIONS = "src/app/clients/actions.ts";
const CLIENTS_ACTIONS_TEST = "src/app/clients/actions.test.ts";
const INSURANCE_FORM = "src/app/clients/_components/insurance-status-form.tsx";

export const mutants = [
  // ── Перевірка гарнесу на profiles (не доводять AC): якщо ці два не KILLED, PGlite-гарнес нічого не доводить ──────
  {
    id: "P1", kind: "sql", ac: "(перевірка гарнесу)", file: PROFILES, tests: [PROFILES_DB],
    what: "колонковий grant: користувач може змінити собі role (самопідвищення)",
    find: "grant update (full_name) on table public.profiles to authenticated;",
    replace: "grant update (full_name, role) on table public.profiles to authenticated;",
  },
  {
    id: "P2", kind: "sql", ac: "(перевірка гарнесу)", file: PROFILES, tests: [PROFILES_DB],
    what: "політика select: будь-хто з входом бачить усі профілі",
    find: "    id = (select auth.uid())\n    or (select private.current_app_role()) = 'admin'",
    replace: "    true",
  },
  // ── AC-CARD-05: терапевт не отримує чужої картки ───────────────────────────────────────────────────────────────
  {
    id: "C1", kind: "sql", ac: "AC-CARD-05", file: CLIENT_CARD, tests: [CARD_DB],
    what: "політика clients_select_therapist: терапевт бачить усі картки, а не лише «своїх» клієнтів",
    find: "using (id in (select private.own_client_ids()));",
    replace: "using (true);",
  },
  {
    id: "C2", kind: "sql", ac: "AC-CARD-05", file: OWN_CLIENT, tests: [CARD_DB],
    what: "own_client_ids(): «свій клієнт» — клієнт будь-якого терапевта, а не лише поточного",
    find: "where s.therapist_id = (select private.current_therapist_id())",
    replace: "where true",
  },
  // ── AC-HOLD-44: терапевт не отримує слотів і утримань чужих терапевтів і планувальника ─────────────────────────
  {
    id: "H1", kind: "sql", ac: "AC-HOLD-44", file: SLOTS_AND_HOLDS, tests: HOLD_DB,
    what: "політика slots_select: терапевт бачить слоти всіх терапевтів",
    find: "using ((select private.is_scheduler_or_admin()) or therapist_id = (select private.current_therapist_id()));",
    replace: "using (true);",
  },
  {
    id: "H2", kind: "sql", ac: "AC-HOLD-44", file: SLOTS_AND_HOLDS, tests: HOLD_DB,
    what: "політика holds_select: терапевт бачить утримання всіх слотів",
    find: "using (\n    (select private.is_scheduler_or_admin())\n    or (\n      slot_id in",
    replace: "using (\n    true\n    or (\n      slot_id in",
  },
  // ── AC-INS-01…05: статус перевірки страхування (міграція insurance_status, ADR 0005) ───────────────────────────
  {
    id: "I1", kind: "sql", ac: "AC-INS-05", file: INSURANCE, tests: [INSURANCE_DB],
    what: "політика clients_update_insurance_staff: статус змінює будь-хто, зокрема терапевт",
    find: "using ((select private.is_scheduler_or_admin()))",
    replace: "using (true)",
  },
  {
    id: "I2", kind: "sql", ac: "AC-INS-02", file: INSURANCE, tests: [INSURANCE_DB],
    what: "with check політики: «Not set» (і будь-яке значення) можна виставити знову",
    find: "with check (insurance_status in ('Verified', 'Not accepted', 'Private pay'))",
    replace: "with check (true)",
  },
  {
    id: "I3", kind: "sql", ac: "AC-INS-02", file: INSURANCE, tests: [INSURANCE_DB, CARD_DB],
    what: "grant update на всю таблицю замість колонки insurance_status: планувальник редагує будь-яку колонку картки",
    find: "grant update (insurance_status) on table public.clients to authenticated;",
    replace: "grant update on table public.clients to authenticated;",
  },
  {
    id: "I4", kind: "sql", ac: "AC-INS-02", file: INSURANCE, tests: [INSURANCE_DB],
    what: "немає grant update (insurance_status): планувальник не може позначити статус",
    find: "grant update (insurance_status) on table public.clients to authenticated;",
    replace: "select 1;",
  },
  {
    id: "I5", kind: "sql", ac: "AC-INS-02", file: INSURANCE, tests: [INSURANCE_DB],
    what: "немає check таблиці на значення статусу: service_role (в обхід політики) записує довільний текст",
    find: ",\n  add constraint clients_insurance_status_check\n    check (insurance_status in ('Not set', 'Verified', 'Not accepted', 'Private pay'));",
    replace: ";",
  },
  {
    id: "I6", kind: "sql", ac: "AC-INS-01", file: INSURANCE, tests: [INSURANCE_DB],
    what: "початковий статус не «Not set»: нові й старі картки починають із «Verified»",
    find: "add column insurance_status text not null default 'Not set'",
    replace: "add column insurance_status text not null default 'Verified'",
  },
  {
    id: "I7", kind: "sql", ac: "AC-INS-01", file: INSURANCE, tests: [INSURANCE_DB],
    what: "grant insert (insurance_status): планувальник створює картку одразу з виставленим статусом",
    find: "grant update (insurance_status) on table public.clients to authenticated;",
    replace: "grant insert (insurance_status), update (insurance_status) on table public.clients to authenticated;",
  },
  {
    id: "I8", kind: "sql", ac: "AC-INS-02", file: INSURANCE, tests: [INSURANCE_DB],
    what: "повноту картки знову перевіряє й update: старій картці без дати й мови не можна позначити статус",
    find: "  after insert on public.clients",
    replace: "  after insert or update on public.clients",
  },
  // ── Сторінки (TS): відмова з текстом PM ────────────────────────────────────────────────────────────────────
  {
    id: "T1", kind: "ts", ac: "AC-CARD-16", file: CLIENT_PAGE, tests: [CLIENT_PAGE_TEST],
    what: "картки немає: тексти для планувальника й терапевта поміняно місцями",
    find: 'noticeFor(STAFF.includes(role) ? "CLIENT_NOT_FOUND" : "CLIENT_ACCESS_DENIED")',
    replace: 'noticeFor(!STAFF.includes(role) ? "CLIENT_NOT_FOUND" : "CLIENT_ACCESS_DENIED")',
  },
  {
    id: "T2", kind: "ts", ac: "AC-HOLD-44", file: "src/app/slots/page.tsx", tests: ["src/app/slots/page.test.tsx"],
    what: "/slots: терапевт не отримує відмови й бачить слоти",
    find: 'if (!STAFF.includes(role)) return <AppShell role={role} email={email} title="Slots"',
    replace: 'if (false) return <AppShell role={role} email={email} title="Slots"',
  },
  {
    id: "T3", kind: "ts", ac: "AC-HOLD-44", file: "src/app/holds/page.tsx", tests: ["src/app/holds/page.test.tsx"],
    what: "/holds: терапевт не отримує відмови й бачить утримання",
    find: 'if (!STAFF.includes(role)) return <AppShell role={role} email={email} title="Holds"',
    replace: 'if (false) return <AppShell role={role} email={email} title="Holds"',
  },
  // ── AC-INS-01…06: статус перевірки страхування (дія й сторінка; Stryker цю дію не мутує: його службовий виклик на
  // початку тіла функції ламає правило check:actions у пісочниці, тож точкові мутанти — тут) ─────────────────────────
  {
    id: "T4", kind: "ts", ac: "AC-INS-05", file: CLIENTS_ACTIONS, tests: [CLIENTS_ACTIONS_TEST],
    what: "дія: нуль зачеплених рядків (терапевт напряму) вважаємо збереженням і показуємо «Insurance status saved.»",
    find: "if (data.length !== 1) redirect(",
    replace: "if (false) redirect(",
  },
  {
    id: "T5", kind: "ts", ac: "AC-INS-02", file: CLIENTS_ACTIONS, tests: [CLIENTS_ACTIONS_TEST],
    what: "дія: update не обмежено карткою з форми (оновлюється чужий id)",
    find: '.eq("id", clientId)',
    replace: '.eq("id", "other")',
  },
  {
    id: "T6", kind: "ts", ac: "AC-INS-02", file: CLIENTS_ACTIONS, tests: [CLIENTS_ACTIONS_TEST],
    what: "дія: після збереження повідомлення не «Insurance status saved.»",
    find: "redirect(`${page}?msg=INSURANCE_SAVED`)",
    replace: "redirect(`${page}?msg=CLIENT_CREATED`)",
  },
  {
    id: "T7", kind: "ts", ac: "AC-CARD-11", file: CLIENTS_ACTIONS, tests: [CLIENTS_ACTIONS_TEST],
    what: "дія: користувач без ролі не повертається на головну, запит іде до бази",
    find: 'if (!role) redirect("/");\n\n  const clientId',
    replace: "const clientId",
  },
  {
    id: "T8", kind: "ts", ac: "AC-INS-02", file: CLIENTS_ACTIONS, tests: [CLIENTS_ACTIONS_TEST],
    what: "дія: id із форми потрапляє в адресу редиректу без кодування",
    find: "const page = `/clients/${encodeURIComponent(clientId)}`;",
    replace: "const page = `/clients/${clientId}`;",
  },
  {
    id: "T9", kind: "ts", ac: "AC-INS-04", file: CLIENT_PAGE, tests: [CLIENT_PAGE_TEST],
    what: "сторінка картки: форма зміни статусу є й у терапевта",
    find: "{STAFF.includes(role) ? <InsuranceStatusForm",
    replace: "{true ? <InsuranceStatusForm",
  },
  {
    id: "T10", kind: "ts", ac: "AC-INS-02", file: INSURANCE_FORM, tests: [CLIENT_PAGE_TEST],
    what: "форма: у списку для вибору є «Not set» (повернути початковий статус можна)",
    find: 'const SETTABLE = ["Verified", "Not accepted", "Private pay"];',
    replace: 'const SETTABLE = ["Not set", "Verified", "Not accepted", "Private pay"];',
  },
  {
    id: "T11", kind: "ts", ac: "AC-INS-02", file: "src/lib/messages.ts", tests: ["src/lib/messages.test.ts"],
    what: "«Insurance status saved.» показано як помилку, а не як успіх",
    find: '["CLIENT_CREATED", "INSURANCE_SAVED", "HELD", "CONFIRMED"]',
    replace: '["CLIENT_CREATED", "HELD", "CONFIRMED"]',
  },
  {
    id: "T12", kind: "ts", ac: "AC-INS-01", file: "src/app/clients/_components/client-card.tsx", tests: [CLIENT_PAGE_TEST],
    what: "картка не показує рядок «Insurance: <статус>»",
    find: "{`Insurance: ${client.insurance_status}`}",
    replace: "{``}",
  },
];
