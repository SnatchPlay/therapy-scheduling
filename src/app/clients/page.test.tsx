import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientCardData } from "./_components/client-card";

// Страницю без Next і бази: requireRole дає фейковий Supabase (він віддає те, що дав би RLS), Link і дії — заглушки.
let role = "scheduler";
let rows: ClientCardData[] = [];
let failure: unknown = null;
const supabase = {
  from: () => ({
    select: () => ({ order: () => ({ order: async () => ({ data: failure ? null : rows, error: failure }) }) }),
  }),
};
const requireRole = vi.fn<(...roles: string[]) => Promise<unknown>>(async () => ({ supabase, role, email: `${role}@example.test` }));
vi.mock("@/lib/supabase/viewer", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/supabase/viewer")>()),
  requireRole,
}));
vi.mock("@/app/login/actions", () => ({ signOut: async () => {} }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { default: ClientsPage } = await import("./page");

async function render(msg?: string) {
  const props = { params: Promise.resolve({}), searchParams: Promise.resolve({ msg }) };
  return renderToStaticMarkup(await ClientsPage(props as PageProps<"/clients">));
}

const adult: ClientCardData = {
  id: "c6",
  client_type: "Adult",
  full_name: "Client Six",
  email: "client6@example.test",
  birth_date: "1990-05-14",
  session_language: "English",
  guardian_name: null,
  guardian_email: null,
};
const child: ClientCardData = {
  id: "c7",
  client_type: "Child",
  full_name: "Client Seven",
  email: null,
  birth_date: "2015-03-02",
  session_language: "Spanish",
  guardian_name: "Guardian Seven",
  guardian_email: "guardian7@example.test",
};
const legacy: ClientCardData = { ...adult, id: "c1", full_name: "Client One", email: "client1@example.test", birth_date: null, session_language: null };

beforeEach(() => {
  role = "scheduler";
  rows = [];
  failure = null;
  requireRole.mockClear();
});

describe("/clients", () => {
  it("AC-CARD-04: терапевт бачить картки з усіма даними анкети (для дитини — з даними опікуна), без кнопки створення", async () => {
    role = "therapist";
    rows = [adult, child];
    const html = await render();
    for (const text of ["Client Six", "client6@example.test", "1990-05-14", "English", "Client Seven", "Guardian Seven", "guardian7@example.test", "2015-03-02", "Spanish"]) {
      expect(html).toContain(text);
    }
    expect(html.match(/data-testid="client-card"/g)).toHaveLength(2);
    expect(html).not.toContain("New client");
  });

  it("AC-CARD-09: терапевт без клієнтів бачить повідомлення й жодної картки", async () => {
    role = "therapist";
    const html = await render();
    expect(html).toContain("No clients yet. Clients appear here when a scheduler holds a slot with you.");
    expect(html).not.toContain('data-testid="client-card"');
  });

  it("AC-CARD-10: планувальник бачить усі картки, у картці дитини — дані опікуна, і кнопку створення", async () => {
    rows = [adult, child, legacy];
    const html = await render();
    expect(html.match(/data-testid="client-card"/g)).toHaveLength(3);
    expect(html).toContain("Guardian Seven");
    expect(html).toContain("guardian7@example.test");
    expect(html).toContain('href="/clients/new"');
    expect(html).toContain('href="/clients/c7"');
  });

  it("AC-CARD-10: адміністратор бачить ті самі картки", async () => {
    role = "admin";
    rows = [adult, child];
    expect(await render()).toContain("New client");
  });

  it("картка зрізу 1 (ім'я й email): відсутні поля показано як «Not provided»", async () => {
    rows = [legacy];
    const html = await render();
    expect(html.match(/Not provided/g)).toHaveLength(2);
    expect(html).toContain("client1@example.test");
  });

  it("порожній список планувальника — підказка створити першу картку", async () => {
    expect(await render()).toContain("Create the first client card.");
  });

  it("запит до бази однаковий для всіх ролей: будь-яка роль із профілем, без ролі — на головну (requireRole)", async () => {
    await render();
    expect(requireRole).toHaveBeenCalledWith("admin", "scheduler", "therapist");
  });

  it("AC-CARD-01: повідомлення після створення картки", async () => {
    expect(await render("CLIENT_CREATED")).toContain("Client created.");
  });

  it("збій бази — помилка, а не порожній список", async () => {
    failure = { message: "boom" };
    await expect(render()).rejects.toEqual({ message: "boom" });
  });
});
