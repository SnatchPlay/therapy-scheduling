import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CardFormState, IntakeDraftState } from "../actions";

// Форма без браузера: стан дій підміняємо, як його повернули б server actions (створення картки й запит чернетки).
let state: CardFormState = null;
let draft: IntakeDraftState = null;
const { createClientCard, requestIntakeDraft } = vi.hoisted(() => ({
  createClientCard: async () => null,
  requestIntakeDraft: async () => null,
}));
vi.mock("react", async (importActual) => ({
  ...(await importActual<typeof import("react")>()),
  useActionState: (action: unknown) => [action === requestIntakeDraft ? draft : state, () => {}, false],
}));
vi.mock("../actions", () => ({ createClientCard, requestIntakeDraft }));

const { ClientCardForm } = await import("./client-card-form");
const render = () => renderToStaticMarkup(<ClientCardForm />);

beforeEach(() => {
  state = null;
  draft = null;
});

const invalid = (html: string) => html.match(/aria-invalid="true"/g)?.length ?? 0;
const ids = (html: string) => [...html.matchAll(/<p id="(error-[A-Z_]+)"/g)].map((m) => m[1]);

describe("ClientCardForm", () => {
  it("AC-CARD-12: початково — тип не вибрано (перший пункт порожній), без email і опікуна, без помилок", () => {
    const html = render();
    for (const label of ["Client type", "Name", "Date of birth (YYYY-MM-DD)", "Session language"]) expect(html).toContain(`>${label}</label>`);
    expect(html).not.toContain(">Email</label>");
    expect(html).not.toContain("Guardian");
    expect(html).not.toContain('role="alert"');
    expect(invalid(html)).toBe(0);
    // Тип і мову треба вибрати: перші пункти порожні.
    expect(html).toMatch(/<option [^>]*value="" disabled="" selected="">Choose a type<\/option>/);
    expect(html).toMatch(/<option [^>]*value="" disabled="" selected="">Choose a language<\/option>/);
  });

  it("AC-CARD-01: тип «Adult» — email клієнта без опікуна", () => {
    state = { codes: [], values: { client_type: "Adult" } };
    const html = render();
    expect(html).toContain(">Email</label>");
    expect(html).not.toContain("Guardian");
  });

  it("AC-CARD-12: кілька помилок одразу — окремий текст під кожним полем, кожне поле пов'язане зі своїм текстом, дані лишаються", () => {
    state = {
      codes: ["INVALID_CLIENT_NAME", "INVALID_BIRTH_DATE", "INVALID_LANGUAGE"],
      values: {
        client_type: "Child",
        full_name: "",
        birth_date: "2999-01-01",
        session_language: "",
        guardian_name: "Guardian Eight",
        guardian_email: "guardian8@example.test",
      },
    };
    const html = render();
    for (const text of ["Enter the client&#x27;s name.", "Enter a date of birth that is not in the future.", "Select a session language."]) {
      expect(html).toContain(text);
    }
    expect(ids(html)).toEqual(["error-INVALID_CLIENT_NAME", "error-INVALID_BIRTH_DATE", "error-INVALID_LANGUAGE"]);
    expect(invalid(html)).toBe(3);
    expect(html).toMatch(/id="full_name"[^>]*aria-describedby="error-INVALID_CLIENT_NAME"/);
    expect(html).toMatch(/id="birth_date"[^>]*aria-describedby="error-INVALID_BIRTH_DATE"/);
    expect(html).toMatch(/id="session_language"[^>]*aria-describedby="error-INVALID_LANGUAGE"/);
    // Опікун без помилок, його дані лишились.
    expect(html).toContain('value="guardian8@example.test"');
    expect(html).toContain('value="2999-01-01"');
  });

  it("AC-CARD-12: тип не вибрано — повідомлення під полем типу", () => {
    state = { codes: ["INVALID_TYPE", "INVALID_CLIENT_NAME"], values: { client_type: "", full_name: "" } };
    const html = render();
    expect(html).toContain("Select a client type.");
    expect(html).toMatch(/id="client_type"[^>]*aria-describedby="error-INVALID_TYPE"/);
  });

  it("AC-CARD-12: ім'я й email дорослого — одне повідомлення під іменем, обидва поля пов'язані з ним", () => {
    state = { codes: ["INVALID_CLIENT"], values: { client_type: "Adult", full_name: "", email: "x" } };
    const html = render();
    expect(html.match(/Enter the client&#x27;s name and a valid email\./g)).toHaveLength(1);
    expect(invalid(html)).toBe(2);
    expect(html.match(/aria-describedby="error-INVALID_CLIENT"/g)).toHaveLength(2);
  });

  it("AC-CARD-03: помилка опікуна — одне повідомлення, обидва поля опікуна пов'язані з ним, дані лишаються", () => {
    state = {
      codes: ["INVALID_GUARDIAN"],
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
    expect(html.match(/Enter the guardian&#x27;s name and a valid email\./g)).toHaveLength(1);
    expect(html).toContain('value="Client Eight"');
    expect(html).toContain('value="2016-01-10"');
    expect(html).toContain('value="guardian8@example.test"');
    expect(html).toMatch(/<option [^>]*value="English"[^>]*selected/);
    // Для дитини власного email немає, а поля опікуна є; помилка пов'язана лише з ними.
    expect(html).not.toContain(">Email</label>");
    expect(html).toContain(">Guardian name</label>");
    // Тип лишається «Child» (defaultValue), а не повертається до порожнього чи «Adult».
    expect(html).toMatch(/<option [^>]*value="Child"[^>]*selected/);
    expect(invalid(html)).toBe(2);
    expect(html.match(/aria-describedby="error-INVALID_GUARDIAN"/g)).toHaveLength(2);
  });

  it("AC-CARD-06: відмова терапевту — Alert над формою, дані лишаються, жодне поле не позначено помилкою", () => {
    state = {
      codes: ["CARD_FORBIDDEN"],
      values: { client_type: "Adult", full_name: "Client Six", email: "client6@example.test", birth_date: "1990-05-14", session_language: "English" },
    };
    const html = render();
    expect(html).toContain("Only schedulers and admins can create client cards.");
    expect(html).toContain('data-slot="alert"');
    expect(html).toContain('value="client6@example.test"');
    expect(invalid(html)).toBe(0);
  });

  it("AC-CARD-13: дублікат картки дитини — загальний Alert над формою, поля не позначено", () => {
    state = { codes: ["CLIENT_DUPLICATE"], values: { client_type: "Child", full_name: "Client Seven", guardian_name: "Guardian Seven" } };
    const html = render();
    expect(html).toContain("A client with these details already exists.");
    expect(html).toContain('data-slot="alert"');
    expect(invalid(html)).toBe(0);
  });

  it("AC-HOLD-16: дубль email позначає лише поле email і показує текст під ним", () => {
    state = { codes: ["CLIENT_EXISTS"], values: { client_type: "Adult", full_name: "Client One", email: "client1@example.test" } };
    const html = render();
    expect(invalid(html)).toBe(1);
    expect(html).toContain("A client with this email already exists.");
    expect(html).toMatch(/id="email"[^>]*aria-describedby="error-CLIENT_EXISTS"/);
  });
});

describe("ClientCardForm: чернетка з тексту звернення", () => {
  const draftOf = (values: Partial<Record<string, string>>, message = "Draft ready. Check the fields and create the card."): IntakeDraftState => ({
    kind: "draft",
    message,
    text: "Hi, my name is Client Ten.",
    values: { client_type: "", full_name: "", birth_date: "", session_language: "", email: "", guardian_name: "", guardian_email: "", ...values },
  });

  it("панель є над формою: поле звернення, підказка про діагнози, кнопка, ліміт 2000 символів", () => {
    const html = render();
    expect(html).toContain('for="intake_text"');
    expect(html).toMatch(/<textarea[^>]*name="text"[^>]*maxLength="2000"|<textarea[^>]*maxLength="2000"[^>]*name="text"/);
    expect(html).toContain("Don&#x27;t paste diagnoses or other health details: name, date of birth, language and contacts are enough.");
    expect(html).toContain("Draft from request");
    expect(html.indexOf("intake_text")).toBeLessThan(html.indexOf('id="client_type"'));
  });

  it("AC-INTAKE-01: чернетка дорослого заповнює форму, показано «Draft ready…»", () => {
    draft = draftOf({
      client_type: "Adult",
      full_name: "Client Ten",
      birth_date: "1990-05-14",
      session_language: "English",
      email: "client10@example.test",
    });
    const html = render();
    expect(html).toMatch(/<option [^>]*value="Adult"[^>]*selected/);
    expect(html).toContain('value="Client Ten"');
    expect(html).toContain('value="1990-05-14"');
    expect(html).toMatch(/<option [^>]*value="English"[^>]*selected/);
    expect(html).toContain('value="client10@example.test"');
    expect(html).toContain("Draft ready. Check the fields and create the card.");
  });

  it("AC-INTAKE-02: чернетка дитини — тип Child, поля опікуна, без email клієнта", () => {
    draft = draftOf({
      client_type: "Child",
      full_name: "Client Eleven",
      birth_date: "2016-09-03",
      session_language: "Spanish",
      guardian_name: "Guardian Eleven",
      guardian_email: "guardian11@example.test",
    });
    const html = render();
    expect(html).toMatch(/<option [^>]*value="Child"[^>]*selected/);
    expect(html).toContain('value="Client Eleven"');
    expect(html).toMatch(/<option [^>]*value="Spanish"[^>]*selected/);
    expect(html).toContain('value="Guardian Eleven"');
    expect(html).toContain('value="guardian11@example.test"');
    expect(html).not.toContain('id="email"');
  });

  it("AC-INTAKE-04: неповна чернетка — порожні поля й повідомлення «Missing: …»", () => {
    draft = draftOf({ client_type: "Adult", full_name: "Client Twelve", email: "client12@example.test" }, "Draft is incomplete. Missing: Date of birth, Session language. Fill them in manually.");
    const html = render();
    expect(html).toContain("Draft is incomplete. Missing: Date of birth, Session language. Fill them in manually.");
    expect(html).toMatch(/id="birth_date"[^>]*value=""/);
    expect(html).toMatch(/<option [^>]*value="" disabled="" selected="">Choose a language<\/option>/);
  });

  // Відмова й «недоступний» не змінюють форму: поля лишаються як були (state — те, що було введено), текст звернення не губиться.
  const expectFormKept = (kind: "refused" | "unavailable", message: string) => {
    state = { codes: [], values: { client_type: "Adult", full_name: "Client Fifteen" } };
    draft = { kind, message, text: "Can you recommend a good book about anxiety?" };
    const html = render();
    expect(html).toContain('value="Client Fifteen"');
    expect(html).toContain(message.replaceAll("'", "&#x27;"));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Can you recommend a good book about anxiety?");
  };

  it("AC-INTAKE-06: відмова — Name лишається «Client Fifteen», повідомлення про відмову над формою", () => {
    expectFormKept("refused", "This text can't be used to draft a client card. Paste the client's request or fill in the form manually.");
  });

  it("AC-INTAKE-07: відмова на вказівки в тексті — поля не змінено, те саме повідомлення про відмову", () => {
    expectFormKept("refused", "This text can't be used to draft a client card. Paste the client's request or fill in the form manually.");
  });

  it("AC-INTAKE-08: помічник недоступний — поля не змінено, картку можна заповнити вручну", () => {
    expectFormKept("unavailable", "The assistant is unavailable right now. Fill in the form manually.");
    expect(render()).toContain("Create client");
  });
});
