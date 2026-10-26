import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Головна — розвилка за роллю: redirect у Next кидає виняток, тут — так само, з адресою в тексті.
let role: string | null = null;
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("@/lib/supabase/viewer", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/supabase/viewer")>()),
  getViewer: async () => ({ role, email: "user@example.test" }),
}));
vi.mock("@/app/login/actions", () => ({ signOut: async () => {} }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { default: Home } = await import("./page");
const open = () => Home();

beforeEach(() => {
  role = null;
});

describe("/", () => {
  it.each([
    ["therapist", "/schedule"],
    ["scheduler", "/slots"],
    ["admin", "/slots"],
  ])("%s → %s", async (r, to) => {
    role = r;
    await expect(open()).rejects.toThrow(`REDIRECT ${to}`);
  });

  it("AC-CARD-11: користувач без ролі бачить лише повідомлення про відсутність доступу, без даних і навігації", async () => {
    const html = renderToStaticMarkup(await open());
    expect(html).toContain("Your account has no access yet. Contact an administrator.");
    for (const word of [">Slots<", ">Holds<", ">Clients<", ">Schedule<", "data-testid=\"client-card\""]) expect(html).not.toContain(word);
    expect(html).toContain("user@example.test · no role");
  });
});
