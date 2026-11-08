import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Страницю без Next і бази: Supabase віддає те, що дав би RLS (нуль рядків для чужої картки), як у Next.
let role = "therapist";
let result: { data: unknown; error: { code?: string; message: string } | null } = { data: null, error: null };
const eq = vi.fn(() => ({ maybeSingle: async () => result }));
const supabase = { from: () => ({ select: () => ({ eq }) }) };
vi.mock("@/lib/supabase/viewer", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/supabase/viewer")>()),
  // Як справжній requireRole: ролі, якої немає в переданому списку, — перенаправлення на головну.
  requireRole: async (...roles: string[]) => {
    if (!roles.includes(role)) throw new Error("REDIRECT /");
    return { supabase, role, email: `${role}@example.test` };
  },
}));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const { default: ClientPage } = await import("./page");
const open = async (id: string, msg?: string) =>
  renderToStaticMarkup(await ClientPage({ params: Promise.resolve({ id }), searchParams: Promise.resolve({ msg }) } as PageProps<"/clients/[id]">));

const card = {
  id: "c7",
  client_type: "Child",
  full_name: "Client Seven",
  email: null,
  birth_date: "2015-03-02",
  session_language: "Spanish",
  guardian_name: "Guardian Seven",
  guardian_email: "guardian7@example.test",
  insurance_status: "Not set",
};

/** Пункти списку вибору статусу з розмітки сторінки: значення, текст, чи недоступний і чи вибраний. */
function optionsOf(html: string) {
  return [...html.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)].map(([, attrs, text]) => ({
    value: /value="([^"]*)"/.exec(attrs)?.[1] ?? "",
    text,
    disabled: attrs.includes("disabled"),
    selected: attrs.includes("selected"),
  }));
}

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

  it("AC-CARD-10: планувальник бачить будь-яку картку", async () => {
    role = "scheduler";
    result = { data: card, error: null };
    expect(await open("c7")).toContain("Guardian Seven");
  });

  it("AC-CARD-16: картки немає — планувальник бачить «This client card doesn't exist.», терапевт — відмову як для чужої, даних немає", async () => {
    for (const r of ["scheduler", "admin"]) {
      role = r;
      const html = await open("missing");
      expect(html).toContain("This client card doesn&#x27;t exist.");
      expect(html).not.toContain("have access");
    }
    role = "therapist";
    const html = await open("missing");
    expect(html).toContain("You don&#x27;t have access to this client.");
    expect(html).not.toContain("exist");
  });

  it("AC-INS-01: картка без позначки показує «Insurance: Not set», планувальник бачить форму зі статусами", async () => {
    role = "scheduler";
    result = { data: card, error: null };
    const html = await open("c7");
    expect(html).toContain("Insurance: Not set");
    // Три значення, які можна позначити; «Not set» серед них немає (повернути його не можна), порожній пункт недоступний.
    expect(optionsOf(html)).toEqual([
      // «Not set» — вибраним лишається порожній пункт-підказка: `required` не дасть зберегти, не обравши статус.
      { value: "", text: "Choose a status", disabled: true, selected: true },
      { value: "Verified", text: "Verified", disabled: false, selected: false },
      { value: "Not accepted", text: "Not accepted", disabled: false, selected: false },
      { value: "Private pay", text: "Private pay", disabled: false, selected: false },
    ]);
    expect(html).toContain('<input type="hidden" name="client_id" value="c7"/>');
  });

  it("AC-INS-02: після збереження сторінка показує «Insurance status saved.» і новий статус", async () => {
    role = "scheduler";
    result = { data: { ...card, insurance_status: "Verified" }, error: null };
    const html = await open("c7", "INSURANCE_SAVED");
    expect(html).toContain("Insurance status saved.");
    expect(html).toContain("Insurance: Verified");
    // Поточний статус у списку вибрано, щоб повторне збереження не скинуло його.
    expect(optionsOf(html).filter((o) => o.selected)).toEqual([
      { value: "Verified", text: "Verified", disabled: false, selected: true },
    ]);
  });

  it("AC-INS-03: адміністратор теж має форму й бачить статус, який позначив планувальник", async () => {
    role = "admin";
    result = { data: { ...card, insurance_status: "Private pay" }, error: null };
    const html = await open("c7");
    expect(html).toContain("Insurance: Private pay");
    expect(html).toContain('name="insurance_status"');
  });

  it("AC-INS-04: терапевт бачить статус у картці свого клієнта, але форми зміни йому не пропонують", async () => {
    role = "therapist";
    result = { data: { ...card, insurance_status: "Not accepted" }, error: null };
    const html = await open("c7");
    expect(html).toContain("Insurance: Not accepted");
    // У шапці завжди є форма «Sign out»; форми статусу (поле, вибір, кнопка) бути не має.
    expect(html).not.toContain('name="client_id"');
    expect(html).not.toContain('name="insurance_status"');
    expect(html).not.toContain("Save");
  });

  it("AC-INS-04: повідомлення про збереження терапевт не бачить на відмові — і даних чужої картки теж", async () => {
    role = "therapist";
    // Чужа картка: RLS віддав нуль рядків, статус не показано, а msg не підміняє відмову.
    const html = await open("c9", "INSURANCE_SAVED");
    expect(html).toContain("You don&#x27;t have access to this client.");
    expect(html).not.toContain("Insurance");
  });

  it("збій бази — помилка, а не відмова в доступі", async () => {
    result = { data: null, error: { code: "XX000", message: "boom" } };
    await expect(open("c7")).rejects.toEqual({ code: "XX000", message: "boom" });
  });
});
