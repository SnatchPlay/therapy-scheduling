import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Сторінка без Next і бази: requireRole дає фейковий Supabase; Link і signOut — заглушки.
type Hold = { hold_id: string; starts_at: string; client_name: string; status: string; held_until: string | null };
type Slot = { slot_id: string; starts_at: string; ends_at: string; status: string; client_name: string | null };
let holds: Hold[] = [];
let slots: Slot[] = [];
let me: { id: string; full_name: string } | null = null;
let failure: unknown = null;
let dayAsked: unknown;
// hold_list: select().order().order(); therapists: select().maybeSingle(); day_slots — rpc.
const supabase = {
  from: (table: string) => ({
    select: () =>
      table === "hold_list"
        ? { order: () => ({ order: async () => ({ data: failure ? null : holds, error: failure }) }) }
        : { maybeSingle: async () => ({ data: me, error: null }) },
  }),
  rpc: async (_name: string, args: { p_therapist_id: string; p_day: string }) => {
    dayAsked = args;
    return { data: slots, error: null };
  },
};
vi.mock("@/lib/supabase/viewer", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/supabase/viewer")>()),
  requireRole: async () => ({ supabase, role: "therapist", email: "therapist1@example.test" }),
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

beforeEach(() => {
  holds = [];
  slots = [];
  me = { id: "t1", full_name: "Therapist One" };
  failure = null;
  dayAsked = undefined;
});

describe("/schedule", () => {
  it("AC-HOLD-09: утримання з клієнтом і «Held until»; сеанс — без «Held until»", async () => {
    holds = [hold("h1", "Held", "2026-11-03T14:30:00-08:00"), hold("h2", "Confirmed", null)];
    const html = await render();
    expect(html).toContain("client1");
    expect(html).toContain("Held until 2026-11-03 14:30");
    expect(html.match(/Held until/g)).toHaveLength(1);
    expect(html.match(/data-testid="schedule-status">(\w+)</g)).toEqual(
      ["Held", "Confirmed"].map((s) => `data-testid="schedule-status">${s}<`),
    );
  });

  it("слоти питаються за власним терапевтом і обраним днем", async () => {
    await render({ day: "2026-11-05" });
    expect(dayAsked).toEqual({ p_therapist_id: "t1", p_day: "2026-11-05" });
  });

  it("AC-HOLD-21: слот простроченого утримання — «Free», самого утримання в списку немає", async () => {
    slots = [
      { slot_id: "s1", starts_at: "2026-11-05T10:00:00-08:00", ends_at: "2026-11-05T11:00:00-08:00", status: "Free", client_name: null },
    ];
    const html = await render();
    expect(html).toContain("No holds or sessions.");
    expect(html).not.toContain("client1");
    expect(html).toContain('data-testid="slot-status">Free<');
    expect(html).toContain("10:00–11:00");
  });

  it("порожній день — «No slots on this day.»; некоректний ?day= не доходить до бази", async () => {
    const html = await render({ day: "2026-02-31" });
    expect(html).toContain("No slots on this day.");
    expect((dayAsked as { p_day: string }).p_day).not.toBe("2026-02-31");
  });

  it("профіль терапевта без запису в therapists — пояснення, а не порожній розклад", async () => {
    me = null;
    const html = await render();
    expect(html).toContain("No therapist record is linked to your account.");
    expect(html).not.toContain("No slots on this day.");
    expect(dayAsked).toBeUndefined();
  });

  it("збій запиту до бази кидається, а не показується як порожній розклад", async () => {
    failure = { code: "42501", message: "permission denied for view hold_list" };
    await expect(render()).rejects.toBe(failure);
  });
});
