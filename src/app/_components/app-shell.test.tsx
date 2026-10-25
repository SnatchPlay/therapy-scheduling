import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Оболонка без Next: signOut і Link — заглушки.
vi.mock("@/app/login/actions", () => ({ signOut: async () => {} }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { AppShell } = await import("./app-shell");
const render = (props: Partial<React.ComponentProps<typeof AppShell>>) =>
  renderToStaticMarkup(<AppShell role="scheduler" email="scheduler1@example.test" title="Slots" {...props}>content</AppShell>);

describe("AppShell", () => {
  it("повідомлення після redirect — Alert з role=alert і текстом: помилка і успіх", () => {
    for (const tone of ["error", "success"] as const) {
      const html = render({ notice: { text: "Slot held.", tone } });
      expect(html).toContain('role="alert"');
      expect(html).toContain(">Slot held.<");
    }
  });

  it("помилка має межу destructive, успіх — primary; без повідомлення Alert немає", () => {
    expect(render({ notice: { text: "x", tone: "error" } })).toContain("border-destructive");
    expect(render({ notice: { text: "x", tone: "success" } })).toContain("border-primary");
    expect(render({})).not.toContain('data-slot="alert"');
  });

  it("навігація за роллю: планувальник бачить Slots, Holds, Clients; терапевт — лише Schedule", () => {
    const staff = render({});
    for (const label of [">Slots<", ">Holds<", ">Clients<"]) expect(staff).toContain(label);
    expect(staff).not.toContain(">Schedule<");
    const therapist = render({ role: "therapist" });
    expect(therapist).toContain(">Schedule<");
    expect(therapist).not.toContain(">Holds<");
  });
});
