import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Сторінка без Next і бази: requireRole дає фейковий Supabase; Link і signOut — заглушки.
// Тут лише відображення даних і запит тижня; що розклад обмежено власним і непростроченим, доводять тести бази
// (tests/db/schedule-db.test.ts).
type Slot = {
  slot_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  client_name: string | null;
  held_until: string | null;
};
let slots: Slot[] = [];
let me: { id: string; full_name: string } | null = null;
let meError: unknown = null;
let rpcError: unknown = null;
let rpcCall: { name: string; args: { p_therapist_id: string; p_from: string; p_to: string } } | undefined;
// therapists: select().maybeSingle(); slots_between — rpc.
const supabase = {
  from: () => ({ select: () => ({ maybeSingle: async () => ({ data: meError ? null : me, error: meError }) }) }),
  rpc: async (name: string, args: { p_therapist_id: string; p_from: string; p_to: string }) => {
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

async function render(searchParams: Record<string, string> = { week: "2026-11-04" }) {
  const props = { params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) };
  return renderToStaticMarkup(await SchedulePage(props as PageProps<"/schedule">));
}
// Час слота — у поясі практики (PST у листопаді, -08:00).
const slot = (day: string, time: string, status: string, client: string | null = null, heldUntil: string | null = null): Slot => ({
  slot_id: `s-${day}-${time}`,
  starts_at: `${day}T${time}:00-08:00`,
  ends_at: `${day}T${String(Number(time.slice(0, 2)) + 1).padStart(2, "0")}:00:00-08:00`,
  status,
  client_name: client,
  held_until: heldUntil,
});
const statuses = (html: string) => [...html.matchAll(/data-testid="slot-status">(\w+)</g)].map((m) => m[1]);

beforeEach(() => {
  slots = [];
  me = { id: "t1", full_name: "Therapist One" };
  meError = rpcError = null;
  rpcCall = undefined;
  requireRole.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("/schedule", () => {
  it("сторінка лише для терапевта", async () => {
    await render();
    expect(requireRole).toHaveBeenCalledWith("therapist");
  });

  it("AC-HOLD-30: тиждень 2026-11-02 – 2026-11-08 зі слотами за днями: «Confirmed», «Held» з клієнтом і «Held until», вільні", async () => {
    slots = [
      slot("2026-11-02", "10:00", "Confirmed", "client1"),
      slot("2026-11-06", "10:00", "Held", "client1", "2026-11-07T10:00:00-08:00"),
      slot("2026-11-06", "11:00", "Free"),
      slot("2026-11-06", "12:00", "Free"),
    ];
    const html = await render({ week: "2026-11-04" }); // середа
    expect(rpcCall).toEqual({ name: "slots_between", args: { p_therapist_id: "t1", p_from: "2026-11-02", p_to: "2026-11-09" } });
    expect(html).toContain("2026-11-02 – 2026-11-08");
    expect(statuses(html)).toEqual(["Confirmed", "Held", "Free", "Free"]);
    expect(html).toContain("Monday 2026-11-02");
    expect(html).toContain("Friday 2026-11-06");
    expect(html).toContain("10:00–11:00");
    expect(html).toContain("client1");
    expect(html).toContain("Held until 2026-11-07 10:00");
    expect(html.match(/Held until/g)).toHaveLength(1);
    expect(html).not.toContain("2026-11-12");
  });

  it("AC-HOLD-30: без ?week= — поточний тиждень практики (середа 2026-11-04 → тиждень з 2026-11-02)", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-04T20:00:00Z"), toFake: ["Date"] });
    await render({});
    expect(rpcCall?.args).toMatchObject({ p_from: "2026-11-02", p_to: "2026-11-09" });
  });

  it("AC-HOLD-30: слот понеділка 23:00 за часом практики (у UTC вже вівторок) — під «Monday 2026-11-02»", async () => {
    slots = [
      { slot_id: "late", starts_at: "2026-11-03T07:00:00Z", ends_at: "2026-11-03T08:00:00Z", status: "Free", client_name: null, held_until: null },
    ];
    const html = await render({ week: "2026-11-04" });
    expect(html).toContain("Monday 2026-11-02");
    expect(html).not.toContain("Tuesday");
  });

  it("AC-HOLD-30: неділя ввечері за часом практики (у UTC вже понеділок) — ще той самий тиждень", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-09T05:00:00Z"), toFake: ["Date"] }); // неділя 2026-11-08 21:00 PST
    await render({});
    expect(rpcCall?.args).toMatchObject({ p_from: "2026-11-02", p_to: "2026-11-09" });
  });

  it("AC-HOLD-31: наступний тиждень 2026-11-09 – 2026-11-15 із сеансом 2026-11-12 о 10:00 «Confirmed»; посилання між тижнями", async () => {
    slots = [slot("2026-11-12", "10:00", "Confirmed", "client1")];
    const html = await render({ week: "2026-11-09" });
    expect(rpcCall?.args).toMatchObject({ p_from: "2026-11-09", p_to: "2026-11-16" });
    expect(html).toContain("2026-11-09 – 2026-11-15");
    expect(html).toContain("Thursday 2026-11-12");
    expect(statuses(html)).toEqual(["Confirmed"]);
    expect(html).toContain('href="/schedule?week=2026-11-02"');
    expect(html).toContain('href="/schedule?week=2026-11-16"');
    expect(html).toContain('href="/schedule"');
  });

  it("AC-HOLD-21: слот простроченого утримання — «Free» і без клієнта", async () => {
    slots = [slot("2026-11-05", "10:00", "Free")];
    const html = await render();
    expect(statuses(html)).toEqual(["Free"]);
    expect(html).not.toContain("client1");
  });

  it("порожній тиждень — «No slots this week.»; некоректний ?week= не доходить до бази", async () => {
    const html = await render({ week: "2026-02-31" });
    expect(html).toContain("No slots this week.");
    expect(rpcCall?.args.p_from).not.toBe("2026-02-31");
  });

  it("профіль терапевта без запису в therapists — пояснення, а не порожній розклад", async () => {
    me = null;
    const html = await render();
    expect(html).toContain("No therapist record is linked to your account.");
    expect(html).not.toContain("No slots this week.");
    expect(rpcCall).toBeUndefined();
  });

  it.each([
    ["терапевта", () => (meError = { code: "42501", message: "permission denied for table therapists" })],
    ["слотів тижня", () => (rpcError = { code: "42883", message: "function slots_between does not exist" })],
  ])("збій запиту %s кидається, а не показується як порожній розклад", async (_name, fail) => {
    const failure = fail();
    await expect(render()).rejects.toBe(failure);
  });
});
