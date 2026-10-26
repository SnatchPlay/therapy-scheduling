import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Страницю без Next і бази: requireRole дає фейкову відповідь, форма — заглушка.
let role = "therapist";
const requireRole = vi.fn<(...roles: string[]) => Promise<unknown>>(async () => ({ supabase: {}, role, email: `${role}@example.test` }));
vi.mock("@/lib/supabase/viewer", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/supabase/viewer")>()),
  requireRole,
}));
vi.mock("../_components/client-card-form", () => ({ ClientCardForm: () => <form data-testid="card-form" /> }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { default: NewClientPage } = await import("./page");

beforeEach(() => {
  role = "therapist";
  requireRole.mockClear();
});

describe("/clients/new", () => {
  it("AC-CARD-06: терапевт за прямим посиланням бачить форму (відмову на спробу створити дає база)", async () => {
    expect(renderToStaticMarkup(await NewClientPage())).toContain('data-testid="card-form"');
    expect(requireRole).toHaveBeenCalledWith("admin", "scheduler", "therapist");
  });

  it("AC-CARD-01: планувальник бачить ту саму форму під заголовком «New client»", async () => {
    role = "scheduler";
    expect(renderToStaticMarkup(await NewClientPage())).toContain(">New client<");
  });
});
