import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Сторінка без Next і бази: requireRole дає фейковий Supabase; server actions і Link — заглушки.
type Slot = { slot_id: string; starts_at: string; ends_at: string; status: string; holdable: boolean };
let slots: Slot[] = [];
let withClients = true;
let role = "scheduler";
let queries = 0; // запити до бази: відмова ролі їх не робить
const clientRows = [
  { id: "c1", full_name: "Client One", client_type: "Adult", email: "client1@example.test", guardian_email: null },
  { id: "c7", full_name: "Client Seven", client_type: "Child", email: null, guardian_email: "guardian7@example.test" },
];
const query = (data: unknown[]) => ({ select: () => ({ order: async () => ({ data, error: null }) }) });
const supabase = {
  from: (table: string) => {
    queries++;
    return query(table === "therapists" ? [{ id: "t1", full_name: "Therapist One" }] : withClients ? clientRows : []);
  },
  rpc: async () => {
    queries++;
    return { data: slots, error: null };
  },
};
vi.mock("@/lib/supabase/viewer", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/supabase/viewer")>()),
  // Як справжній requireRole: ролі, якої немає в переданому списку, — перенаправлення на головну.
  requireRole: async (...roles: string[]) => {
    if (!roles.includes(role)) throw new Error("REDIRECT /");
    return { supabase, role, email: `${role}@example.test` };
  },
}));
vi.mock("./actions", () => ({ holdSlot: async () => {} }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { default: SlotsPage } = await import("./page");

async function render(extra: Record<string, string> = {}) {
  const props = { params: Promise.resolve({}), searchParams: Promise.resolve({ therapist: "t1", day: "2026-11-04", ...extra }) };
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
  withClients = true;
  role = "scheduler";
  queries = 0;
});

describe("/slots", () => {
  it("AC-HOLD-44: терапевт за посиланням на слоти (у тому числі іншого терапевта) бачить лише відмову, без слотів і клієнтів і без запитів до бази", async () => {
    role = "therapist";
    slots = [slot("10:00", "Free", true)];
    const html = await render();
    expect(html).toContain("Only schedulers and admins can view this page.");
    expect(html).toContain('role="alert"');
    for (const text of ['data-testid="slot"', "Therapist One", "Client One", "guardian7@example.test", ">Hold<", NO_FREE]) {
      expect(html).not.toContain(text);
    }
    expect(queries).toBe(0);
  });

  it.each(["scheduler", "admin"])("AC-HOLD-44: %s бачить слоти без відмови", async (r) => {
    role = r;
    slots = [slot("10:00", "Free", true)];
    const html = await render();
    expect(html).toContain('data-testid="slot"');
    expect(html).not.toContain("Only schedulers and admins can view this page.");
  });

  it("AC-CARD-02: у виборі клієнта біля дитини показано email опікуна, біля дорослого — його власний", async () => {
    slots = [slot("10:00", "Free", true)];
    const html = await render();
    expect(html).toContain(">Client Seven (guardian: guardian7@example.test)<");
    expect(html).toContain(">Client One (client1@example.test)<");
  });

  it("AC-CARD-02: клієнта-дитину знаходять за email опікуна: у виборі лише він, з email опікуна, а поле пошуку зберігає запит", async () => {
    slots = [slot("10:00", "Free", true), slot("11:00", "Free", true)];
    const html = await render({ client: "guardian7@example.test" });
    expect(html.match(/>Client Seven \(guardian: guardian7@example\.test\)</g)).toHaveLength(2); // по одному в кожному вільному слоті
    expect(html).not.toContain("Client One");
    expect(html).toContain('value="guardian7@example.test"');
    expect(html).toContain(">Find a client</label>");
    // Поле належить GET-формі (поряд із терапевтом і днем) і має ім'я `client`, інакше запит ніколи не дійшов би до сторінки.
    const getForm = html.slice(html.indexOf('method="get"'));
    expect(getForm.slice(0, getForm.indexOf("</form>"))).toMatch(/<input[^>]*name="client"/);
  });

  it("AC-CARD-02: клієнта знаходять і за серединою email (не лише за початком); два значення ?client= — запит ігнорується, у виборі всі", async () => {
    slots = [slot("10:00", "Free", true)];
    expect(await render({ client: "7@example" })).not.toContain("Client One");
    const props = { params: Promise.resolve({}), searchParams: Promise.resolve({ therapist: "t1", day: "2026-11-04", client: ["a", "b"] }) };
    const html = renderToStaticMarkup(await SlotsPage(props as unknown as PageProps<"/slots">));
    expect(html).toContain("Client One");
    expect(html).toContain("Client Seven");
  });

  it("AC-CARD-02: без запиту у виборі всі клієнти; за іменем знаходять і дорослого", async () => {
    slots = [slot("10:00", "Free", true)];
    const all = await render();
    expect(all).toContain("Client One");
    expect(all).toContain("Client Seven");
    const byName = await render({ client: "one" });
    expect(byName).toContain(">Client One (client1@example.test)<");
    expect(byName).not.toContain("Client Seven");
  });

  it("AC-CARD-02: запит без збігів — слот без вибору й кнопки Hold, з поясненням «No clients match.» (а не «Create a client first»)", async () => {
    slots = [slot("10:00", "Free", true)];
    const html = await render({ client: "nobody" });
    expect(html.match(/No clients match\./g)).toHaveLength(1); // одним рядком над списком, а не в кожному слоті
    expect(html).not.toContain(">Hold<");
    expect(html).not.toContain("Create a client first");
    expect(html).not.toContain("Choose a client");
  });

  it("AC-CARD-01: без жодного клієнта вільний слот веде створити картку, а не показує вибір", async () => {
    withClients = false;
    slots = [slot("10:00", "Free", true)];
    const html = await render();
    expect(html).toContain('href="/clients/new"');
    expect(html).toContain("Create a client first");
    expect(html).not.toContain("Choose a client");
    expect(html).not.toContain("No clients match.");
  });

  it("AC-HOLD-01: вільний слот — кнопка Hold лише в нього, повідомлення немає", async () => {
    slots = [slot("10:00", "Free", true), slot("11:00", "Held", false), slot("12:00", "Confirmed", false)];
    const html = await render();
    expect(html).not.toContain(NO_FREE);
    expect(html.match(/data-testid="slot-status">(\w+)</g)).toEqual(
      ["Free", "Held", "Confirmed"].map((s) => `data-testid="slot-status">${s}<`),
    );
    expect(html.match(/>Hold</g)).toHaveLength(1);
    // Клієнта треба вибрати: перший пункт порожній.
    expect(html).toMatch(/<option [^>]*value="" disabled="" selected="">Choose a client<\/option>/);
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

  it("AC-HOLD-33: слоти «Past», «Past», «Held», «Confirmed» — повідомлення, під ним усі чотири слоти зі статусами, без кнопок Hold", async () => {
    slots = [slot("10:00", "Past", false), slot("11:00", "Past", false), slot("13:00", "Held", false), slot("14:00", "Confirmed", false)];
    const html = await render();
    const message = html.indexOf(NO_FREE);
    expect(message).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="slot"')).toBeGreaterThan(message);
    expect(html.match(/data-testid="slot-status">(\w+)</g)).toEqual(
      ["Past", "Past", "Held", "Confirmed"].map((st) => `data-testid="slot-status">${st}<`),
    );
    expect(html).not.toContain(">Hold<");
  });

  it("AC-HOLD-24: день без жодного слоту — лише повідомлення", async () => {
    const html = await render();
    expect(html).toContain(NO_FREE);
    expect(html).not.toContain('data-testid="slot"');
  });
});
