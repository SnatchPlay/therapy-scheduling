import { beforeEach, describe, expect, it, vi } from "vitest";

// Server action без Next і бази: getViewer дає фейковий клієнт Supabase, redirect кидає ціль (як у Next).
const insert = vi.fn();
const from = vi.fn<(table: string) => { insert: typeof insert }>(() => ({ insert }));
const revalidatePath = vi.fn();
let role: string | null = "scheduler";
const getViewer = vi.fn(async () => ({ supabase: { from }, role }));
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

const { createClientCard } = await import("./actions");

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
  role = "scheduler";
});

describe("createClientCard", () => {
  it("AC-CARD-01: поля картки дорослого йдуть у свої колонки, успіх → повідомлення про створення", async () => {
    insert.mockResolvedValue({ error: null });
    expect(await redirectOf(createClientCard(null, adult()))).toBe("/clients?msg=CLIENT_CREATED");
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

  it("AC-CARD-03: база відмовила через опікуна — повідомлення про опікуна, введені дані лишаються у формі", async () => {
    insert.mockResolvedValue({ error: { code: "23514", message: 'violates check constraint "clients_guardian_check"' } });
    const state = await createClientCard(null, child({ guardian_email: "" }));
    expect(state).toEqual({
      code: "INVALID_GUARDIAN",
      values: expect.objectContaining({ full_name: "Client Seven", birth_date: "2015-03-02", guardian_name: "Guardian Seven", guardian_email: "" }),
    });
  });

  it("AC-CARD-01: порожня дата чи не РРРР-ММ-ДД (`epoch`, `-infinity`, 06.05.1990, 2015-02-30) — відмова без запиту до бази, дані лишаються", async () => {
    for (const birth_date of ["  ", "epoch", "-infinity", "yesterday", "06.05.1990", "1990-5-14", "2015-02-30"]) {
      const state = await createClientCard(null, adult({ birth_date }));
      expect(state).toEqual({ code: "INVALID_BIRTH_DATE", values: expect.objectContaining({ full_name: "Client Six" }) });
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("AC-CARD-01: дата з майбутнього й мова не вибрана — відмова бази → повідомлення про дату чи мову", async () => {
    insert.mockResolvedValueOnce({ error: { code: "P0001", message: "INVALID_BIRTH_DATE" } });
    expect(await createClientCard(null, adult({ birth_date: "2999-01-01" }))).toMatchObject({ code: "INVALID_BIRTH_DATE" });
    insert.mockResolvedValueOnce({ error: { code: "23514", message: 'violates check constraint "clients_session_language_check"' } });
    expect(await createClientCard(null, adult({ session_language: "" }))).toMatchObject({ code: "INVALID_LANGUAGE" });
    expect(insert).toHaveBeenLastCalledWith(expect.objectContaining({ session_language: "" }));
  });

  it("AC-CARD-06: терапевт доходить до бази, і відмову дає RLS — повідомлення про права, дані лишаються", async () => {
    role = "therapist";
    insert.mockResolvedValue({ error: { code: "42501", message: 'new row violates row-level security policy for table "clients"' } });
    const state = await createClientCard(null, adult());
    expect(state).toMatchObject({ code: "CARD_FORBIDDEN", values: expect.objectContaining({ full_name: "Client Six" }) });
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("AC-CARD-06: терапевт із порожньою формою доходить до бази й бачить відмову за правами, а не повідомлення про дату", async () => {
    role = "therapist";
    insert.mockResolvedValue({ error: { code: "42501", message: 'new row violates row-level security policy for table "clients"' } });
    const state = await createClientCard(null, adult({ full_name: "", email: "", birth_date: "", session_language: "" }));
    expect(state).toMatchObject({ code: "CARD_FORBIDDEN" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ birth_date: null }));
  });

  it("AC-CARD-11: користувач без ролі повертається на головну, до бази не доходить", async () => {
    role = null;
    expect(await redirectOf(createClientCard(null, adult()))).toBe("/");
    expect(insert).not.toHaveBeenCalled();
  });

  it("AC-HOLD-11: порожнє ім'я йде в базу як є — її обмеження відмовляють", async () => {
    insert.mockResolvedValue({ error: { code: "23514", message: 'violates check constraint "clients_full_name_check"' } });
    expect(await createClientCard(null, adult({ full_name: "" }))).toMatchObject({ code: "INVALID_CLIENT" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ full_name: "" }));
  });

  it("AC-HOLD-11: файл замість тексту й невідомий тип — порожнє значення, а не «[object File]»", async () => {
    insert.mockResolvedValue({ error: { code: "23514", message: 'violates check constraint "clients_full_name_check"' } });
    await createClientCard(null, adult({ full_name: new File(["x"], "name.txt"), client_type: "Foo" }));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ client_type: "Adult", full_name: "" }));
  });

  it("AC-HOLD-16: помилка унікальності email → повідомлення про наявного клієнта", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: 'violates unique constraint "clients_email_key"' } });
    expect(await createClientCard(null, adult({ email: "client1@example.test" }))).toMatchObject({ code: "CLIENT_EXISTS" });
  });

  it("непередбачена помилка бази кидається далі (лог сервера, error.tsx)", async () => {
    const failure = { code: "42501", message: "permission denied for table clients" };
    insert.mockResolvedValue({ error: failure });
    await expect(createClientCard(null, adult())).rejects.toBe(failure);
  });
});
