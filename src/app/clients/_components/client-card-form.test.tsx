import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CardFormState } from "../actions";

// Форма без браузера: стан дії підміняємо, як його повернув би server action після відмови.
let state: CardFormState = null;
vi.mock("react", async (importActual) => ({
  ...(await importActual<typeof import("react")>()),
  useActionState: () => [state, () => {}, false],
}));
vi.mock("../actions", () => ({ createClientCard: async () => null }));

const { ClientCardForm } = await import("./client-card-form");
const render = () => renderToStaticMarkup(<ClientCardForm />);

beforeEach(() => {
  state = null;
});

describe("ClientCardForm", () => {
  it("AC-CARD-01: початково — картка дорослого: email клієнта, дата народження, мова; без опікуна й без помилки", () => {
    const html = render();
    for (const label of ["Client type", "Name", "Email", "Date of birth (YYYY-MM-DD)", "Session language"]) expect(html).toContain(`>${label}</label>`);
    expect(html).not.toContain("Guardian");
    expect(html).not.toContain('role="alert"');
    // Мову треба вибрати: перший пункт порожній.
    expect(html).toMatch(/<option [^>]*value="" disabled="" selected="">Choose a language<\/option>/);
  });

  it("AC-CARD-03: після відмови введені дані лишаються у формі, а повідомлення про опікуна показано з прив'язкою до полів", () => {
    state = {
      code: "INVALID_GUARDIAN",
      values: {
        client_type: "Child",
        full_name: "Client Eight",
        birth_date: "2016-01-10",
        session_language: "English",
        guardian_name: "",
        guardian_email: "guardian8@example.test",
      },
    };
    const html = render();
    expect(html).toContain("Enter the guardian&#x27;s name and a valid email.");
    expect(html).toContain('value="Client Eight"');
    expect(html).toContain('value="2016-01-10"');
    expect(html).toContain('value="guardian8@example.test"');
    expect(html).toMatch(/<option [^>]*value="English"[^>]*selected/);
    // Для дитини власного email немає, а поля опікуна є; відмова пов'язана з полями опікуна, не з іменем.
    expect(html).not.toContain('>Email</label>');
    expect(html).toContain(">Guardian name</label>");
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(2);
    expect(html.match(/aria-describedby="card-form-error"/g)).toHaveLength(2);
    expect(html).toContain('id="card-form-error"');
  });

  it("AC-CARD-06: відмова терапевту показується над формою, дані лишаються", () => {
    state = {
      code: "CARD_FORBIDDEN",
      values: { client_type: "Adult", full_name: "Client Six", email: "client6@example.test", birth_date: "1990-05-14", session_language: "English" },
    };
    const html = render();
    expect(html).toContain("Only schedulers and admins can create client cards.");
    expect(html).toContain('value="client6@example.test"');
    expect(html).not.toContain('aria-invalid="true"');
  });

  it("AC-HOLD-16: дубль email позначає лише поле email", () => {
    state = { code: "CLIENT_EXISTS", values: { client_type: "Adult", full_name: "Client One", email: "client1@example.test" } };
    const html = render();
    expect(html.match(/aria-invalid="true"/g)).toHaveLength(1);
    expect(html).toContain("A client with this email already exists.");
  });
});
