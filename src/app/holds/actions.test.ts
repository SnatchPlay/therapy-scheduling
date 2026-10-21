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

const { confirmHold } = await import("./actions");

function form(fields: Record<string, string | File>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

async function redirectTarget(action: Promise<unknown>) {
  const error = await action.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(Redirect);
  return (error as Redirect).url;
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockReset();
});

describe("confirmHold", () => {
  it("AC-HOLD-12: confirm_hold з id утримання; успіх → «Hold confirmed.» на /holds", async () => {
    rpc.mockResolvedValue({ error: null });
    expect(await redirectTarget(confirmHold(form({ hold_id: "h1" })))).toBe("/holds?msg=CONFIRMED");
    expect(rpc).toHaveBeenCalledWith("confirm_hold", { p_hold_id: "h1" });
    expect(revalidatePath).toHaveBeenCalledWith("/holds");
  });

  it("AC-HOLD-13, AC-HOLD-22, AC-HOLD-36: відмова бази → її повідомлення на /holds, утримання лишається в списку", async () => {
    for (const code of ["HOLD_EXPIRED", "CONFIRM_SLOT_STARTED", "HOLD_ALREADY_CONFIRMED"]) {
      rpc.mockResolvedValue({ error: { code: "P0001", message: code } });
      expect(await redirectTarget(confirmHold(form({ hold_id: "h1" })))).toBe(`/holds?msg=${code}`);
    }
  });

  it("AC-HOLD-14: терапевт — повідомлення на головній, бо /holds його туди перенаправляє", async () => {
    rpc.mockResolvedValue({ error: { code: "42501", message: "CONFIRM_FORBIDDEN" } });
    expect(await redirectTarget(confirmHold(form({ hold_id: "h1" })))).toBe("/?msg=CONFIRM_FORBIDDEN");
  });

  it("непередбачена помилка бази (зокрема HOLD_NOT_FOUND) кидається далі — лог сервера, error.tsx", async () => {
    for (const failure of [
      { code: "P0002", message: "HOLD_NOT_FOUND" },
      { code: "22P02", message: 'invalid input syntax for type uuid: "x"' },
    ]) {
      rpc.mockResolvedValue({ error: failure });
      await expect(confirmHold(form({ hold_id: "x" }))).rejects.toBe(failure);
    }
  });

  it("поле без значення чи файл замість тексту — без запиту до бази", async () => {
    for (const data of [new FormData(), form({ hold_id: new File(["x"], "h.txt") })]) {
      expect(await redirectTarget(confirmHold(data))).toBe("/holds?msg=UNEXPECTED");
    }
    expect(rpc).not.toHaveBeenCalled();
  });
});
