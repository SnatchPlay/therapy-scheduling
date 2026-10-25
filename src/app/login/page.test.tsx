import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Сторінка входу без Next і бази: server action — заглушка. Тексти англійські, як і решта інтерфейсу (припущення PM).
vi.mock("./actions", () => ({ login: async () => {} }));

const { default: LoginPage } = await import("./page");

async function render(error?: string) {
  const props = { params: Promise.resolve({}), searchParams: Promise.resolve({ error }) };
  return renderToStaticMarkup(await LoginPage(props as PageProps<"/login">));
}

describe("/login", () => {
  it("форма: заголовок, поля email і пароль, кнопка — англійською", async () => {
    const html = await render();
    expect(html).toContain(">Sign in</h1>");
    expect(html).toContain("Email");
    expect(html).toContain("Password");
    expect(html).toContain(">Sign in</button>");
    expect(html).not.toContain('role="alert"');
  });

  it.each([
    ["missing", "Enter your email and password."],
    ["invalid", "Wrong email or password."],
  ])("помилка %s → «%s»", async (code, text) => {
    const html = await render(code);
    expect(html).toContain('role="alert"');
    expect(html).toContain(text);
  });

  it("невідомий код помилки — без повідомлення", async () => {
    expect(await render("x")).not.toContain('role="alert"');
  });
});
