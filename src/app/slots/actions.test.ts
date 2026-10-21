import { beforeEach, describe, expect, it, vi } from "vitest";

// Server action без Next і бази: getViewer дає фейковий клієнт Supabase, redirect кидає ціль (як у Next).
const rpc = vi.fn();
const revalidatePath = vi.fn();
vi.mock("@/lib/supabase/viewer", () => ({ getViewer: async () => ({ supabase: { rpc } }) }));
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

const { holdSlot } = await import("./actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}
const FIELDS = { slot_id: "s1", client_id: "c1", therapist: "t1", day: "2026-11-03" };

async function redirectOf(action: Promise<unknown>) {
  const error = await action.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(Redirect);
  return new URL((error as Redirect).url, "http://x");
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockReset();
});

describe("holdSlot", () => {
  it("AC-HOLD-02: hold_slot зі слотом і клієнтом; успіх → «Slot held.» на тому ж терапевті й дні", async () => {
    rpc.mockResolvedValue({ error: null });
    const url = await redirectOf(holdSlot(form(FIELDS)));
    expect(rpc).toHaveBeenCalledWith("hold_slot", { p_slot_id: "s1", p_client_id: "c1" });
    expect(url.pathname).toBe("/slots");
    expect(Object.fromEntries(url.searchParams)).toEqual({ therapist: "t1", day: "2026-11-03", msg: "HELD" });
    expect(revalidatePath).toHaveBeenCalledWith("/slots");
  });

  it("AC-HOLD-03: код помилки бази → його повідомлення", async () => {
    rpc.mockResolvedValue({ error: { code: "P0001", message: "SLOT_UNAVAILABLE" } });
    const url = await redirectOf(holdSlot(form(FIELDS)));
    // Роль staff бачить повідомлення на /slots, а не на головній.
    expect(url.pathname).toBe("/slots");
    expect(url.searchParams.get("msg")).toBe("SLOT_UNAVAILABLE");
  });

  it("непередбачена помилка бази кидається далі (лог сервера, error.tsx)", async () => {
    const failure = { code: "22P02", message: 'invalid input syntax for type uuid: "x"' };
    rpc.mockResolvedValue({ error: failure });
    await expect(holdSlot(form(FIELDS))).rejects.toBe(failure);
  });

  it("AC-HOLD-08: терапевт — повідомлення на головній, бо /slots його туди перенаправляє", async () => {
    rpc.mockResolvedValue({ error: { code: "42501", message: "HOLD_FORBIDDEN" } });
    const url = await redirectOf(holdSlot(form(FIELDS)));
    expect(url.pathname + url.search).toBe("/?msg=HOLD_FORBIDDEN");
  });

  it("поле без значення чи файл замість тексту — без запиту до бази", async () => {
    const noSlot = { therapist: FIELDS.therapist, day: FIELDS.day, client_id: FIELDS.client_id };
    const withFile = form(FIELDS);
    withFile.set("client_id", new File(["x"], "c.txt"));
    for (const data of [form(noSlot), withFile]) {
      const url = await redirectOf(holdSlot(data));
      expect(Object.fromEntries(url.searchParams)).toEqual({ therapist: "t1", day: "2026-11-03", msg: "UNEXPECTED" });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("без терапевта й дня в формі — порожні параметри, сторінка візьме типові", async () => {
    rpc.mockResolvedValue({ error: null });
    const url = await redirectOf(holdSlot(form({ slot_id: "s1", client_id: "c1" })));
    expect(Object.fromEntries(url.searchParams)).toEqual({ therapist: "", day: "", msg: "HELD" });
  });
});
