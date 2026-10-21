import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Сторінка без Next і бази: requireRole дає фейковий Supabase; server actions і Link — заглушки.
type Slot = { slot_id: string; starts_at: string; ends_at: string; status: string; holdable: boolean };
let slots: Slot[] = [];
const query = (data: unknown[]) => ({ select: () => ({ order: async () => ({ data, error: null }) }) });
const supabase = {
  from: (table: string) =>
    query(table === "therapists" ? [{ id: "t1", full_name: "Therapist One" }] : [{ id: "c1", full_name: "Client One", email: "client1@example.test" }]),
  rpc: async () => ({ data: slots, error: null }),
};
vi.mock("@/lib/supabase/viewer", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/supabase/viewer")>()),
  requireRole: async () => ({ supabase, role: "scheduler", email: "scheduler1@example.test" }),
}));
vi.mock("./actions", () => ({ holdSlot: async () => {} }));
vi.mock("@/app/login/actions", () => ({ signOut: async () => {} }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { default: SlotsPage } = await import("./page");

async function render() {
  const props = { params: Promise.resolve({}), searchParams: Promise.resolve({ therapist: "t1", day: "2026-11-04" }) };
  return renderToStaticMarkup(await SlotsPage(props as PageProps<"/slots">));
}
const slot = (time: string, status: string, holdable: boolean): Slot => ({
  slot_id: `s-${time}`,
  starts_at: `2026-11-04T${time}:00-08:00`,
  ends_at: `2026-11-04T${time}:00-08:00`,
  status,
  holdable,
});
const NO_FREE = "No free slots on this day.";

beforeEach(() => {
  slots = [];
});

describe("/slots", () => {
  it("AC-HOLD-01: вільний слот — кнопка Hold лише в нього, повідомлення немає", async () => {
    slots = [slot("10:00", "Free", true), slot("11:00", "Held", false), slot("12:00", "Confirmed", false)];
    const html = await render();
    expect(html).not.toContain(NO_FREE);
    expect(html.match(/data-testid="slot-status">(\w+)</g)).toEqual(
      ["Free", "Held", "Confirmed"].map((s) => `data-testid="slot-status">${s}<`),
    );
    expect(html.match(/>Hold</g)).toHaveLength(1);
    // Клієнта треба вибрати: перший пункт порожній.
    expect(html).toContain('<option value="" disabled="" selected="">Choose a client</option>');
    // У кожному рядку свій список клієнтів: екранний читач розрізняє їх за часом слоту.
    expect(html).toContain('aria-label="Client for 10:00"');
  });

  it("AC-HOLD-18: 10:00 «Held» і 11:00 «Confirmed» — повідомлення, під ним обидва слоти", async () => {
    slots = [slot("10:00", "Held", false), slot("11:00", "Confirmed", false)];
    const html = await render();
    const message = html.indexOf(NO_FREE);
    expect(message).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="slot"')).toBeGreaterThan(message);
    expect(html.match(/data-testid="slot"/g)).toHaveLength(2);
    expect(html).not.toContain(">Hold<");
  });

  it("AC-HOLD-24: день без жодного слоту — лише повідомлення", async () => {
    const html = await render();
    expect(html).toContain(NO_FREE);
    expect(html).not.toContain('data-testid="slot"');
  });
});
