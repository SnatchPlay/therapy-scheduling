import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Страницю без Next і бази: Supabase віддає те, що дав би RLS (нуль рядків для чужої картки), notFound кидає виняток, як у Next.
let role = "therapist";
let result: { data: unknown; error: { code?: string; message: string } | null } = { data: null, error: null };
const eq = vi.fn(() => ({ maybeSingle: async () => result }));
const supabase = { from: () => ({ select: () => ({ eq }) }) };
vi.mock("@/lib/supabase/viewer", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/supabase/viewer")>()),
  requireRole: async () => ({ supabase, role, email: `${role}@example.test` }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { default: ClientPage } = await import("./page");
const open = async (id: string) =>
  renderToStaticMarkup(await ClientPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) } as PageProps<"/clients/[id]">));

const card = {
  id: "c7",
  client_type: "Child",
  full_name: "Client Seven",
  email: null,
  birth_date: "2015-03-02",
  session_language: "Spanish",
  guardian_name: "Guardian Seven",
  guardian_email: "guardian7@example.test",
};

beforeEach(() => {
  role = "therapist";
  result = { data: null, error: null };
  eq.mockClear();
});

describe("/clients/[id]", () => {
  it("AC-CARD-05: терапевт за посиланням на чужу картку бачить відмову й жодних даних клієнта", async () => {
    // RLS не віддає чужого клієнта: нуль рядків.
    const html = await open("c9");
    expect(html).toContain("You don&#x27;t have access to this client.");
    expect(html).not.toContain('data-testid="client-card"');
    // Картку шукаємо за id з адреси, а не «будь-яку».
    expect(eq).toHaveBeenCalledWith("id", "c9");
  });

  it("AC-CARD-05: id, який не є uuid, — та сама відмова для терапевта, а не помилка", async () => {
    result = { data: null, error: { code: "22P02", message: 'invalid input syntax for type uuid: "x"' } };
    expect(await open("x")).toContain("You don&#x27;t have access to this client.");
  });

  it("AC-CARD-04: своя картка — усі дані анкети, для дитини з даними опікуна", async () => {
    result = { data: card, error: null };
    const html = await open("c7");
    for (const text of ["Client Seven", "Guardian Seven", "guardian7@example.test", "2015-03-02", "Spanish"]) expect(html).toContain(text);
    expect(html).not.toContain("have access");
  });

  it("AC-CARD-10: планувальник бачить будь-яку картку; неіснуюча — 404", async () => {
    role = "scheduler";
    result = { data: card, error: null };
    expect(await open("c7")).toContain("Guardian Seven");
    result = { data: null, error: null };
    await expect(open("missing")).rejects.toThrow("NOT_FOUND");
  });

  it("збій бази — помилка, а не відмова в доступі", async () => {
    result = { data: null, error: { code: "XX000", message: "boom" } };
    await expect(open("c7")).rejects.toEqual({ code: "XX000", message: "boom" });
  });
});
