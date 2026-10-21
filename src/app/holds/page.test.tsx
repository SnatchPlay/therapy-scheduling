import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Сторінка без Next і бази: requireRole дає фейковий Supabase; server actions і Link — заглушки.
type Hold = { hold_id: string; therapist_name: string; starts_at: string; client_name: string; held_until: string | null; status: string };
let holds: Hold[] = [];
const supabase = { from: () => ({ select: () => ({ order: async () => ({ data: holds, error: null }) }) }) };
vi.mock("@/lib/supabase/viewer", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/supabase/viewer")>()),
  requireRole: async () => ({ supabase, role: "scheduler", email: "scheduler1@example.test" }),
}));
vi.mock("./actions", () => ({ confirmHold: async () => {} }));
vi.mock("@/app/login/actions", () => ({ signOut: async () => {} }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { default: HoldsPage } = await import("./page");

async function render(msg?: string) {
  const props = { params: Promise.resolve({}), searchParams: Promise.resolve({ msg }) };
  return renderToStaticMarkup(await HoldsPage(props as PageProps<"/holds">));
}
const hold = (id: string, status: string, heldUntil: string | null): Hold => ({
  hold_id: id,
  therapist_name: "Therapist One",
  starts_at: "2026-11-05T10:00:00-08:00",
  client_name: "client1",
  held_until: heldUntil,
  status,
});

beforeEach(() => {
  holds = [];
});

describe("/holds", () => {
  it("AC-HOLD-20: прострочене утримання client1 видно зі статусом «Expired», без кнопки підтвердження", async () => {
    holds = [hold("h1", "Expired", null)];
    const html = await render();
    expect(html).toContain('data-testid="hold-status">Expired<');
    expect(html).toContain("client1");
    expect(html).not.toContain(">Confirm<");
  });

  it("AC-HOLD-12: «Held» — з «Held until» і кнопкою; «Confirmed» — без «Held until» і без кнопки", async () => {
    holds = [hold("h1", "Held", "2026-11-03T14:30:00-08:00"), hold("h2", "Confirmed", null)];
    const html = await render();
    expect(html).toContain("Held until 2026-11-03 14:30");
    expect(html.match(/Held until/g)).toHaveLength(1);
    expect(html.match(/>Confirm</g)).toHaveLength(1);
    expect(html).toContain('data-testid="hold-status">Confirmed<');
  });

  it("повідомлення з ?msg= показано, порожній список — «No holds yet.»", async () => {
    const html = await render("HOLD_EXPIRED");
    expect(html).toContain("This hold has expired. Hold the slot again.");
    expect(html).toContain("No holds yet.");
  });
});
