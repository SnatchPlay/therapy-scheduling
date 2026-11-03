import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Сторінка без Next і бази: requireRole дає фейковий Supabase; server actions і Link — заглушки.
type Hold = { hold_id: string; therapist_name: string; starts_at: string; client_name: string; held_until: string | null; status: string };
let holds: Hold[] = [];
let failure: unknown = null;
let role = "scheduler";
let queries = 0; // запити до бази: відмова ролі їх не робить
// select().order().order(): сторінка сортує за часом слоту й за id; ключі сортування запам'ятовуємо.
const orders: string[] = [];
const supabase = {
  from: () => {
    queries++;
    return {
      select: () => ({
        order: (column: string) => {
          orders.push(column);
          return {
            order: async (second: string) => {
              orders.push(second);
              return { data: failure ? null : holds, error: failure };
            },
          };
        },
      }),
    };
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
vi.mock("./actions", () => ({ confirmHold: async () => {} }));
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
  failure = null;
  orders.length = 0;
  role = "scheduler";
  queries = 0;
});

describe("/holds", () => {
  it("AC-HOLD-44: терапевт за прямим посиланням на список утримань бачить лише відмову, без утримань, імен і email клієнтів і без запитів до бази", async () => {
    role = "therapist";
    holds = [hold("h1", "Held", "2026-11-03T14:30:00-08:00")];
    const html = await render();
    expect(html).toContain("Only schedulers and admins can view this page.");
    expect(html).toContain('role="alert"');
    for (const text of ["client1", "Therapist One", ">Confirm<", "hold-status"]) expect(html).not.toContain(text);
    expect(queries).toBe(0);
  });

  it.each(["scheduler", "admin"])("AC-HOLD-44: %s бачить список утримань без відмови", async (r) => {
    role = r;
    holds = [hold("h1", "Held", "2026-11-03T14:30:00-08:00")];
    const html = await render();
    expect(html).toContain("client1");
    expect(html).not.toContain("Only schedulers and admins can view this page.");
  });

  it("AC-HOLD-20: прострочене утримання client1 видно зі статусом «Expired», без кнопки підтвердження", async () => {
    // hold_list віддає held_until для кожного непідтвердженого утримання, зокрема прострочених: «Held until» лише в «Held».
    holds = [hold("h1", "Expired", "2026-11-03T14:30:00-08:00")];
    const html = await render();
    expect(html).toContain('data-testid="hold-status">Expired<');
    expect(html).toContain("client1");
    expect(html).not.toContain(">Confirm<");
    expect(html).not.toContain("Held until");
  });

  it("AC-HOLD-12: «Held» — з «Held until» і кнопкою підтвердження, «Expired» — без кнопки", async () => {
    holds = [hold("h1", "Held", "2026-11-03T14:30:00-08:00"), hold("h2", "Expired", "2026-11-03T14:30:00-08:00")];
    const html = await render();
    expect(html).toContain("Held until 2026-11-03 14:30");
    expect(html.match(/Held until/g)).toHaveLength(1);
    expect(html.match(/>Confirm</g)).toHaveLength(1);
    // Кнопки в різних рядках розрізняються за клієнтом і слотом.
    expect(html).toContain('aria-label="Confirm hold for client1 at 2026-11-05 10:00"');
  });

  it("AC-HOLD-38: сторінка просить базу впорядкувати утримання за часом слоту від найближчого (з другим ключем для рівних)", async () => {
    holds = [hold("h1", "Held", "2026-11-03T14:30:00-08:00"), hold("h2", "Expired", "2026-11-03T14:30:00-08:00")];
    const html = await render();
    expect(orders).toEqual(["starts_at", "hold_id"]);
    expect(html.match(/data-testid="hold"/g)).toHaveLength(2);
  });

  it("збій запиту до бази кидається, а не показується як порожній список", async () => {
    failure = { code: "42501", message: "permission denied for view hold_list" };
    await expect(render()).rejects.toBe(failure);
  });

  it("повідомлення з ?msg= показано, порожній список — «No holds yet.»", async () => {
    const html = await render("HOLD_EXPIRED");
    expect(html).toContain("This hold has expired. Hold the slot again.");
    expect(html).toContain("No holds yet.");
  });
});
