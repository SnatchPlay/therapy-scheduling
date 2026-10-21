import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Сторінка без Next і бази: requireRole дає фейковий Supabase; Link і signOut — заглушки.
// Тут лише відображення даних: що розклад терапевта обмежено правилами, доводять тести бази (tests/db/schedule-db.test.ts).
type Hold = { hold_id: string; starts_at: string; client_name: string; status: string; held_until: string | null };
type Slot = { slot_id: string; starts_at: string; ends_at: string; status: string; client_name: string | null };
let holds: Hold[] = [];
let slots: Slot[] = [];
let me: { id: string; full_name: string } | null = null;
let holdsError: unknown = null;
let meError: unknown = null;
let rpcError: unknown = null;
let rpcCall: { name: string; args: { p_therapist_id: string; p_day: string } } | undefined;
let holdsQuery: { table: string; order: string[] } | undefined;
// hold_list: select().order(); therapists: select().maybeSingle(); day_slots — rpc.
const supabase = {
  from: (table: string) => ({
    select: () => {
      if (table !== "hold_list") return { maybeSingle: async () => ({ data: meError ? null : me, error: meError }) };
      holdsQuery = { table, order: [] };
      return {
        order: async (column: string) => {
          holdsQuery?.order.push(column);
          return { data: holdsError ? null : holds, error: holdsError };
        },
      };
    },
  }),
  rpc: async (name: string, args: { p_therapist_id: string; p_day: string }) => {
    rpcCall = { name, args };
    return { data: rpcError ? null : slots, error: rpcError };
  },
};
const requireRole = vi.fn<(...roles: string[]) => Promise<unknown>>(async () => ({
  supabase,
  role: "therapist",
  email: "therapist1@example.test",
}));
vi.mock("@/lib/supabase/viewer", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/supabase/viewer")>()),
  requireRole: (...roles: string[]) => requireRole(...roles),
}));
vi.mock("@/app/login/actions", () => ({ signOut: async () => {} }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { default: SchedulePage } = await import("./page");

async function render(searchParams: Record<string, string> = { day: "2026-11-05" }) {
  const props = { params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) };
  return renderToStaticMarkup(await SchedulePage(props as PageProps<"/schedule">));
}
const hold = (id: string, status: string, heldUntil: string | null): Hold => ({
  hold_id: id,
  starts_at: "2026-11-05T10:00:00-08:00",
  client_name: "client1",
  status,
  held_until: heldUntil,
});
const slot = (status: string, clientName: string | null): Slot => ({
  slot_id: "s1",
  starts_at: "2026-11-05T10:00:00-08:00",
  ends_at: "2026-11-05T11:00:00-08:00",
  status,
  client_name: clientName,
});

beforeEach(() => {
  holds = [];
  slots = [];
  me = { id: "t1", full_name: "Therapist One" };
  holdsError = meError = rpcError = null;
  rpcCall = holdsQuery = undefined;
  requireRole.mockClear();
});

describe("/schedule", () => {
  it("сторінка лише для терапевта", async () => {
    await render();
    expect(requireRole).toHaveBeenCalledWith("therapist");
  });

  it("утримання — з клієнтом і «Held until», сеанс — без «Held until»; список із hold_list за часом слоту", async () => {
    holds = [hold("h1", "Held", "2026-11-03T14:30:00-08:00"), hold("h2", "Confirmed", null)];
    const html = await render();
    expect(html).toContain("client1");
    expect(html).toContain("Held until 2026-11-03 14:30");
    expect(html.match(/Held until/g)).toHaveLength(1);
    expect(html.match(/data-testid="schedule-status">(\w+)</g)).toEqual(
      ["Held", "Confirmed"].map((s) => `data-testid="schedule-status">${s}<`),
    );
    expect(html).not.toContain("No holds or sessions.");
    expect(holdsQuery).toEqual({ table: "hold_list", order: ["starts_at"] });
  });

  it("слоти питаються за власним терапевтом і обраним днем; рядок слота показано", async () => {
    slots = [slot("Confirmed", "client1")];
    const html = await render({ day: "2026-11-05" });
    expect(rpcCall).toEqual({ name: "day_slots", args: { p_therapist_id: "t1", p_day: "2026-11-05" } });
    expect(html).toContain("10:00–11:00");
    expect(html).not.toContain("No slots on this day.");
  });

  it("порожній розклад: слот «Free», утримань немає", async () => {
    slots = [slot("Free", null)];
    const html = await render();
    expect(html).toContain("No holds or sessions.");
    expect(html).not.toContain('data-testid="schedule-item"');
    expect(html).toContain('data-testid="slot-status">Free<');
  });

  it("порожній день — «No slots on this day.»; некоректний ?day= не доходить до бази", async () => {
    const html = await render({ day: "2026-02-31" });
    expect(html).toContain("No slots on this day.");
    expect(rpcCall?.args.p_day).not.toBe("2026-02-31");
  });

  it("профіль терапевта без запису в therapists — пояснення, а не порожній розклад", async () => {
    me = null;
    const html = await render();
    expect(html).toContain("No therapist record is linked to your account.");
    expect(html).not.toContain("No slots on this day.");
    expect(rpcCall).toBeUndefined();
  });

  it.each([
    ["утримань", () => (holdsError = { code: "42501", message: "permission denied for view hold_list" })],
    ["терапевта", () => (meError = { code: "42501", message: "permission denied for table therapists" })],
    ["слотів дня", () => (rpcError = { code: "42883", message: "function day_slots does not exist" })],
  ])("збій запиту %s кидається, а не показується як порожній розклад", async (_name, fail) => {
    const failure = fail();
    await expect(render()).rejects.toBe(failure);
  });
});
