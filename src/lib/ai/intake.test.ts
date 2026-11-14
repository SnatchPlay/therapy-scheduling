import { describe, expect, it } from "vitest";
import { buildOutcome, todayInPractice } from "./intake";
import type { ModelDraft } from "./schema";

// Правила чернетки виконує код на виході моделі (design.md, Р32): тут — синтетичні відповіді моделі, без мережі.
const TODAY = "2026-11-13";
const draft = (over: Partial<ModelDraft> = {}): ModelDraft => ({
  status: "ok",
  clientType: "Adult",
  fullName: "Client Ten",
  birthDate: "1990-05-14",
  sessionLanguage: "English",
  email: "client10@example.test",
  guardianName: null,
  guardianEmail: null,
  ...over,
});
const draftOf = (over: Partial<ModelDraft>) => {
  const outcome = buildOutcome(draft(over), TODAY);
  if (outcome.kind !== "draft") throw new Error("очікували чернетку");
  return outcome;
};

describe("AC-INTAKE-05: дата народження пізніша за сьогодні", () => {
  it("AC-INTAKE-05: дата в майбутньому лишає поле порожнім і потрапляє в «Missing»", () => {
    const outcome = draftOf({ clientType: "Adult", fullName: "Client Fourteen", birthDate: "2027-01-05", email: "client14@example.test" });
    expect(outcome.values).toMatchObject({ client_type: "Adult", full_name: "Client Fourteen", birth_date: "", session_language: "English", email: "client14@example.test" });
    expect(outcome.message).toBe("Draft is incomplete. Missing: Date of birth. Fill them in manually.");
  });

  it("AC-INTAKE-05: сьогоднішня дата ще не з майбутнього, завтрашня вже ні", () => {
    expect(draftOf({ birthDate: TODAY }).values.birth_date).toBe(TODAY);
    expect(draftOf({ birthDate: "2026-11-14" }).values.birth_date).toBe("");
  });

  it("AC-INTAKE-05: неіснуюча дата й неповна дата (лише рік, вік) — порожньо", () => {
    for (const birthDate of ["2026-02-30", "1991", "35", "May 14, 1990", ""]) {
      expect(draftOf({ birthDate }).values.birth_date).toBe("");
    }
  });
});

describe("AC-INTAKE-04: «Missing: …» і правила полів", () => {
  it("AC-INTAKE-04: порожні поля називає в порядку форми, без дати й мови", () => {
    const outcome = draftOf({ fullName: "Client Twelve", birthDate: null, sessionLanguage: null, email: "client12@example.test" });
    expect(outcome.missing).toEqual(["Date of birth", "Session language"]);
    expect(outcome.message).toBe("Draft is incomplete. Missing: Date of birth, Session language. Fill them in manually.");
  });

  it("AC-INTAKE-04: для дорослого бракує Email, для дитини — Guardian name і Guardian email, у порядку форми", () => {
    expect(draftOf({ email: null }).missing).toEqual(["Email"]);
    const child = draftOf({ clientType: "Child", birthDate: "2015-08-19", guardianName: null, guardianEmail: null });
    expect(child.missing).toEqual(["Guardian name", "Guardian email"]);
    expect(child.message).toBe("Draft is incomplete. Missing: Guardian name, Guardian email. Fill them in manually.");
  });

  it("AC-INTAKE-04: без типу клієнта пари email-полів немає, «Client type» — перший у списку", () => {
    const outcome = draftOf({ clientType: null, birthDate: null, fullName: null, sessionLanguage: null, email: "client12@example.test" });
    expect(outcome.missing).toEqual(["Client type", "Name", "Date of birth", "Session language"]);
  });

  it("AC-INTAKE-04: модель не знайшла жодних даних клієнта — чернетки немає, це відмова", () => {
    const empty = { status: "needs_info", clientType: null, fullName: null, birthDate: null, sessionLanguage: null, email: null } as const;
    expect(buildOutcome(draft(empty), TODAY)).toEqual({
      kind: "refused",
      message: "This text can't be used to draft a client card. Paste the client's request or fill in the form manually.",
    });
  });
});

describe("AC-INTAKE-01, 02: тип, email, мова", () => {
  it("AC-INTAKE-01: повні дані дорослого — «Draft ready», поля опікуна порожні", () => {
    const outcome = draftOf({});
    expect(outcome.values).toEqual({
      client_type: "Adult",
      full_name: "Client Ten",
      birth_date: "1990-05-14",
      session_language: "English",
      email: "client10@example.test",
      guardian_name: "",
      guardian_email: "",
    });
    expect(outcome.message).toBe("Draft ready. Check the fields and create the card.");
  });

  it("AC-INTAKE-02: повні дані дитини — поля опікуна заповнені, email клієнта порожній", () => {
    const outcome = draftOf({
      clientType: "Child",
      fullName: "Client Eleven",
      birthDate: "2016-09-03",
      sessionLanguage: "Spanish",
      email: "someone@example.test",
      guardianName: "Guardian Eleven",
      guardianEmail: "guardian11@example.test",
    });
    expect(outcome.values).toEqual({
      client_type: "Child",
      full_name: "Client Eleven",
      birth_date: "2016-09-03",
      session_language: "Spanish",
      email: "",
      guardian_name: "Guardian Eleven",
      guardian_email: "guardian11@example.test",
    });
    expect(outcome.message).toBe("Draft ready. Check the fields and create the card.");
  });

  it("AC-INTAKE-01: молодший за 18 за датою народження — завжди «Child», рівно 18 — «Adult» (дата перемагає тип моделі)", () => {
    expect(draftOf({ clientType: "Adult", birthDate: "2008-12-20" }).values.client_type).toBe("Child");
    expect(draftOf({ clientType: "Child", birthDate: "2008-11-01" }).values.client_type).toBe("Child");
    expect(draftOf({ clientType: "Adult", birthDate: "2008-11-01" }).values.client_type).toBe("Adult");
    expect(draftOf({ clientType: "Adult", birthDate: "2008-11-14" }).values.client_type).toBe("Child");
  });

  it("AC-INTAKE-01: email малими літерами без пробілів, без «@» — порожньо", () => {
    expect(draftOf({ email: "  Ellis.Reed@Example.TEST " }).values.email).toBe("ellis.reed@example.test");
    expect(draftOf({ email: "morgan.bell.example.test" }).values.email).toBe("");
  });

  it("AC-INTAKE-01: мова лише English чи Spanish; інша — порожньо", () => {
    expect(draftOf({ sessionLanguage: "spanish" }).values.session_language).toBe("Spanish");
    expect(draftOf({ sessionLanguage: "French" }).values.session_language).toBe("");
  });
});

describe("AC-INTAKE-06: відмова моделі", () => {
  it("AC-INTAKE-06: refused → форма не змінюється, повідомлення дослівно з вимоги", () => {
    expect(buildOutcome(draft({ status: "refused", fullName: "Client Fifteen" }), TODAY)).toEqual({
      kind: "refused",
      message: "This text can't be used to draft a client card. Paste the client's request or fill in the form manually.",
    });
  });
});

describe("todayInPractice", () => {
  it("«сьогодні» — за America/Los_Angeles, а не за UTC", () => {
    // 03:00 UTC 14 листопада = 19:00 13 листопада в Лос-Анджелесі (UTC−8 узимку).
    expect(todayInPractice(new Date("2026-11-14T03:00:00Z"))).toBe("2026-11-13");
    expect(todayInPractice(new Date("2026-11-14T09:00:00Z"))).toBe("2026-11-14");
  });
});
