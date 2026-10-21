import { beforeEach, describe, expect, it, vi } from "vitest";

// Server action без Next і бази: requireRole дає фейковий клієнт Supabase, redirect кидає ціль (як у Next).
const insert = vi.fn();
const from = vi.fn<(table: string) => { insert: typeof insert }>(() => ({ insert }));
const revalidatePath = vi.fn();
const requireRole = vi.fn<(...roles: string[]) => Promise<unknown>>(async () => ({ supabase: { from } }));
vi.mock("@/lib/supabase/viewer", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/supabase/viewer")>()),
  requireRole,
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

function form(fullName: string, email: string) {
  const data = new FormData();
  data.set("full_name", fullName);
  data.set("email", email);
  return data;
}

async function redirectOf(action: Promise<unknown>) {
  const error = await action.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(Redirect);
  return (error as Redirect).url;
}

beforeEach(() => {
  vi.clearAllMocks();
  insert.mockReset();
});

describe("createClientCard", () => {
  it("AC-HOLD-10: поля форми йдуть у свої колонки, успіх → повідомлення про створення", async () => {
    insert.mockResolvedValue({ error: null });
    expect(await redirectOf(createClientCard(form("Client Three", "client3@example.test")))).toBe(
      "/clients?msg=CLIENT_CREATED",
    );
    expect(from).toHaveBeenCalledWith("clients");
    expect(insert).toHaveBeenCalledWith({ full_name: "Client Three", email: "client3@example.test" });
    expect(requireRole).toHaveBeenCalledWith("scheduler", "admin");
    expect(revalidatePath).toHaveBeenCalledWith("/clients");
  });

  it("AC-HOLD-11: поля без значень ідуть у базу порожніми — її обмеження відмовляють", async () => {
    insert.mockResolvedValue({ error: { code: "23514", message: 'violates check constraint "clients_full_name_check"' } });
    expect(await redirectOf(createClientCard(new FormData()))).toBe("/clients?msg=INVALID_CLIENT");
    expect(insert).toHaveBeenCalledWith({ full_name: "", email: "" });
  });

  it("AC-HOLD-16: помилка обмеження бази → код повідомлення, а не «створено»", async () => {
    insert.mockResolvedValue({ error: { code: "23505", message: 'violates unique constraint "clients_email_key"' } });
    expect(await redirectOf(createClientCard(form("Client One", "client1@example.test")))).toBe(
      "/clients?msg=CLIENT_EXISTS",
    );
  });

  it("непередбачена помилка бази кидається далі (лог сервера, error.tsx)", async () => {
    const failure = { code: "42501", message: "permission denied for table clients" };
    insert.mockResolvedValue({ error: failure });
    await expect(createClientCard(form("Client Three", "client3@example.test"))).rejects.toBe(failure);
  });
});
