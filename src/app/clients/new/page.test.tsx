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
  it("AC-CARD-06: терапевт за прямим посиланням одразу бачить відмову, форми немає (спробу в обхід відхиляє база)", async () => {
    const html = renderToStaticMarkup(await NewClientPage());
    expect(html).toContain("Only schedulers and admins can create client cards.");
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('data-testid="card-form"');
    expect(requireRole).toHaveBeenCalledWith("admin", "scheduler", "therapist");
  });

  it.each(["scheduler", "admin"])("AC-CARD-01: %s бачить форму під заголовком «New client», без відмови", async (r) => {
    role = r;
    const html = renderToStaticMarkup(await NewClientPage());
    expect(html).toContain(">New client<");
    expect(html).toContain('data-testid="card-form"');
    expect(html).not.toContain("Only schedulers and admins");
  });
});
