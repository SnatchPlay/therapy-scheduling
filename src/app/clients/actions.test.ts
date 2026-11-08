import { beforeEach, describe, expect, it, vi } from "vitest";

// Server action без Next і бази: getViewer дає фейковий клієнт Supabase, redirect кидає ціль (як у Next).
const insert = vi.fn();
// update(...).eq("id", …).select("id"): ланцюжок supabase-js; select віддає зачеплені рядки (нуль — RLS не бачить картку).
const select = vi.fn();
const eq = vi.fn(() => ({ select }));
const update = vi.fn(() => ({ eq }));
const from = vi.fn<(table: string) => { insert: typeof insert; update: typeof update }>(() => ({ insert, update }));
// client_card_errors: усі помилки картки одним запитом (правила — у базі, tests/db/client-card-db.test.ts).
const rpc = vi.fn();
const revalidatePath = vi.fn();
let role: string | null = "scheduler";
const getViewer = vi.fn(async () => ({ supabase: { from, rpc }, role }));
vi.mock("@/lib/supabase/viewer", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/supabase/viewer")>()),
  getViewer,
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
class Redirect extends Error {
  constructor(readonly url: string) {
    super(url);
  }
}

const { createClientCard, setInsuranceStatus } = await import("./actions");

function form(fields: Record<string, string | File>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}
const adult = (extra: Record<string, string | File> = {}) =>
  form({
    client_type: "Adult",
    full_name: "Client Six",
    email: "client6@example.test",
    birth_date: "1990-05-14",
    session_language: "English",
    ...extra,
  });
const child = (extra: Record<string, string | File> = {}) =>
  form({
    client_type: "Child",
    full_name: "Client Seven",
    birth_date: "2015-03-02",
    session_language: "Spanish",
    guardian_name: "Guardian Seven",
    guardian_email: "guardian7@example.test",
    ...extra,
  });

async function redirectOf(action: Promise<unknown>) {
  const error = await action.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(Redirect);
  return (error as Redirect).url;
}

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockReset();
  select.mockReset();
  rpc.mockReset();
  rpc.mockResolvedValue({ data: [], error: null });
  role = "scheduler";
});

describe("createClientCard", () => {
  it("AC-CARD-01: усі поля йдуть у перевірку бази, потім поля картки дорослого — у свої колонки, успіх → повідомлення про створення", async () => {
    insert.mockResolvedValue({ error: null });
    expect(await redirectOf(createClientCard(null, adult()))).toBe("/clients?msg=CLIENT_CREATED");
    expect(rpc).toHaveBeenCalledWith("client_card_errors", {
      p_card: expect.objectContaining({ client_type: "Adult", full_name: "Client Six", email: "client6@example.test", birth_date: "1990-05-14", session_language: "English" }),
    });
    expect(from).toHaveBeenCalledWith("clients");
    expect(insert).toHaveBeenCalledWith({
      client_type: "Adult",
      full_name: "Client Six",
      email: "client6@example.test",
      birth_date: "1990-05-14",
      session_language: "English",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/clients");
  });

  it("AC-CARD-02: картка дитини йде з даними опікуна й без власного email", async () => {
    insert.mockResolvedValue({ error: null });
    expect(await redirectOf(createClientCard(null, child({ email: "ignored@example.test" })))).toBe("/clients?msg=CLIENT_CREATED");
    expect(insert).toHaveBeenCalledWith({
      client_type: "Child",
      full_name: "Client Seven",
      birth_date: "2015-03-02",
      session_language: "Spanish",
      guardian_name: "Guardian Seven",
      guardian_email: "guardian7@example.test",
    });
  });

  it("AC-CARD-12: база повернула кілька помилок — усі коди одразу, введені дані лишаються, запису немає", async () => {
    rpc.mockResolvedValue({ data: ["INVALID_CLIENT_NAME", "INVALID_BIRTH_DATE", "INVALID_LANGUAGE"], error: null });
    const state = await createClientCard(null, child({ full_name: "", birth_date: "2999-01-01", session_language: "" }));
    expect(state).toEqual({
      codes: ["INVALID_CLIENT_NAME", "INVALID_BIRTH_DATE", "INVALID_LANGUAGE"],
      values: expect.objectContaining({ guardian_name: "Guardian Seven", guardian_email: "guardian7@example.test", birth_date: "2999-01-01" }),
    });
    expect(insert).not.toHaveBeenCalled();
  });

  it("AC-CARD-03: помилка опікуна — повідомлення про опікуна, введені дані лишаються у формі", async () => {
    rpc.mockResolvedValue({ data: ["INVALID_GUARDIAN"], error: null });
    const state = await createClientCard(null, child({ guardian_email: "" }));
    expect(state).toEqual({
      codes: ["INVALID_GUARDIAN"],
      values: expect.objectContaining({ full_name: "Client Seven", birth_date: "2015-03-02", guardian_name: "Guardian Seven", guardian_email: "" }),
    });
  });

  it("AC-CARD-12: код, якого немає в повідомленнях, не доходить до форми як текст — це збій", async () => {
    rpc.mockResolvedValue({ data: ["NOT_A_CODE"], error: null });
    expect(await createClientCard(null, adult())).toMatchObject({ codes: ["UNEXPECTED"] });
  });

  it("AC-CARD-12: файл замість тексту — порожнє значення (а не «[object File]») і в перевірці, і у формі", async () => {
    rpc.mockResolvedValue({ data: ["INVALID_CLIENT"], error: null });
    const state = await createClientCard(null, adult({ full_name: new File(["x"], "name.txt"), client_type: "Foo" }));
    expect(rpc).toHaveBeenCalledWith("client_card_errors", { p_card: expect.objectContaining({ full_name: "", client_type: "Foo" }) });
    expect(state).toMatchObject({ values: expect.objectContaining({ full_name: "" }) });
  });

  it("AC-CARD-01: пробіли навколо дати прибираємо перед перевіркою, у форму повертаємо як ввели", async () => {
    insert.mockResolvedValue({ error: null });
    await redirectOf(createClientCard(null, adult({ birth_date: " 1990-05-14 " })));
    expect(rpc).toHaveBeenCalledWith("client_card_errors", { p_card: expect.objectContaining({ birth_date: "1990-05-14" }) });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ birth_date: "1990-05-14" }));
    rpc.mockResolvedValue({ data: ["INVALID_BIRTH_DATE"], error: null });
    expect(await createClientCard(null, adult({ birth_date: " epoch " }))).toMatchObject({ values: expect.objectContaining({ birth_date: " epoch " }) });
  });

  it("AC-CARD-06: терапевт — перевірка бази повертає відмову за правами, запису немає, дані лишаються", async () => {
    role = "therapist";
    rpc.mockResolvedValue({ data: ["CARD_FORBIDDEN"], error: null });
    const state = await createClientCard(null, adult());
    expect(state).toMatchObject({ codes: ["CARD_FORBIDDEN"], values: expect.objectContaining({ full_name: "Client Six" }) });
    expect(insert).not.toHaveBeenCalled();
  });

  it("AC-CARD-06: якщо запис усе ж дійшов до бази, відмову за правами дає RLS — те саме повідомлення", async () => {
    role = "therapist";
    insert.mockResolvedValue({ error: { code: "42501", message: 'new row violates row-level security policy for table "clients"' } });
    expect(await createClientCard(null, adult())).toMatchObject({ codes: ["CARD_FORBIDDEN"] });
  });

  it("AC-CARD-11: користувач без ролі повертається на головну, до бази не доходить", async () => {
    role = null;
    expect(await redirectOf(createClientCard(null, adult()))).toBe("/");
    expect(rpc).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("AC-CARD-13: помилка унікального індексу картки дитини → повідомлення про дублікат", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: 'duplicate key value violates unique constraint "clients_child_unique"' } });
    expect(await createClientCard(null, child())).toMatchObject({ codes: ["CLIENT_DUPLICATE"], values: expect.objectContaining({ guardian_name: "Guardian Seven" }) });
  });

  it("AC-HOLD-16: помилка унікальності email → повідомлення про наявного клієнта", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: 'violates unique constraint "clients_email_key"' } });
    expect(await createClientCard(null, adult({ email: "client1@example.test" }))).toMatchObject({ codes: ["CLIENT_EXISTS"] });
  });

  it("збій перевірки чи запису кидається далі (лог сервера, error.tsx)", async () => {
    const validationFailure = { code: "42883", message: "function does not exist" };
    rpc.mockResolvedValue({ data: null, error: validationFailure });
    await expect(createClientCard(null, adult())).rejects.toThrow("client_card_errors: 42883 function does not exist");
    rpc.mockResolvedValue({ data: [], error: null });
    // details бази містить рядок із даними картки: до винятку (лог сервера) він не потрапляє.
    const failure = { code: "42501", message: "permission denied for table clients", details: "Failing row contains (Client Six, client6@example.test)" };
    insert.mockResolvedValue({ error: failure });
    const thrown = await createClientCard(null, adult()).then(() => null, (e: unknown) => e as Error);
    expect(thrown?.message).toBe("insert into clients: 42501 permission denied for table clients");
    expect(thrown?.message).not.toContain("client6@example.test");
  });
});

describe("setInsuranceStatus", () => {
  const status = (fields: Record<string, string | File> = {}) =>
    form({ client_id: "c6", insurance_status: "Verified", ...fields });

  it("AC-INS-02: планувальник позначає «Verified» — update саме цієї картки, одна зачеплена картка → «Insurance status saved.»", async () => {
    select.mockResolvedValue({ data: [{ id: "c6" }], error: null });
    expect(await redirectOf(setInsuranceStatus(status()))).toBe("/clients/c6?msg=INSURANCE_SAVED");
    expect(from).toHaveBeenCalledWith("clients");
    expect(update).toHaveBeenCalledWith({ insurance_status: "Verified" });
    expect(eq).toHaveBeenCalledWith("id", "c6");
    expect(revalidatePath).toHaveBeenCalledWith("/clients");
    expect(revalidatePath).toHaveBeenCalledWith("/clients/c6");
  });

  it("AC-INS-03: адміністратор змінює статус так само, на «Private pay»", async () => {
    role = "admin";
    select.mockResolvedValue({ data: [{ id: "c7" }], error: null });
    expect(await redirectOf(setInsuranceStatus(status({ client_id: "c7", insurance_status: "Private pay" })))).toBe(
      "/clients/c7?msg=INSURANCE_SAVED",
    );
    expect(update).toHaveBeenCalledWith({ insurance_status: "Private pay" });
  });

  it("AC-INS-05: терапевт напряму — база (RLS) не зачепила жодної картки: «Something went wrong. Try again.», а не «saved»", async () => {
    role = "therapist";
    select.mockResolvedValue({ data: [], error: null });
    const url = await redirectOf(setInsuranceStatus(status()));
    expect(url).toBe("/clients/c6?msg=UNEXPECTED");
    expect(url).not.toContain("INSURANCE_SAVED");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("AC-INS-02: недозволене значення (відмова політики) — збій у лог сервера, а не «saved»; details бази з даними картки не логуємо", async () => {
    const failure = {
      code: "42501",
      message: 'new row violates row-level security policy for table "clients"',
      details: "Failing row contains (Client Six, client6@example.test)",
    };
    select.mockResolvedValue({ data: null, error: failure });
    const thrown = await setInsuranceStatus(status({ insurance_status: "Not set" })).then(() => null, (e: unknown) => e as Error);
    expect(thrown?.message).toBe(`update clients.insurance_status: 42501 ${failure.message}`);
    expect(thrown?.message).not.toContain("client6@example.test");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("AC-CARD-11: користувач без ролі повертається на головну, до бази не доходить", async () => {
    role = null;
    expect(await redirectOf(setInsuranceStatus(status()))).toBe("/");
    expect(update).not.toHaveBeenCalled();
  });

  it("AC-INS-02: файл замість тексту чи відсутнє поле — збій без запиту до бази", async () => {
    expect(await redirectOf(setInsuranceStatus(status({ insurance_status: new File(["x"], "s.txt") })))).toBe("/clients?msg=UNEXPECTED");
    expect(await redirectOf(setInsuranceStatus(form({ insurance_status: "Verified" })))).toBe("/clients?msg=UNEXPECTED");
    expect(update).not.toHaveBeenCalled();
  });

  it("AC-INS-02: id із символами адреси не виводить редирект за межі сторінки картки", async () => {
    select.mockResolvedValue({ data: [{ id: "x" }], error: null });
    expect(await redirectOf(setInsuranceStatus(status({ client_id: "c6?msg=x#/../login" })))).toBe(
      `/clients/${encodeURIComponent("c6?msg=x#/../login")}?msg=INSURANCE_SAVED`,
    );
  });
});
