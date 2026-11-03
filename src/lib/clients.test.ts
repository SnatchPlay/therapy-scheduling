import { describe, expect, it } from "vitest";
import { clientOptionLabel, filterClients } from "./clients";

describe("clientOptionLabel", () => {
  it("AC-CARD-01: дорослий — ім'я й власний email", () => {
    expect(
      clientOptionLabel({ full_name: "Client Six", client_type: "Adult", email: "client6@example.test", guardian_email: null }),
    ).toBe("Client Six (client6@example.test)");
  });

  it("AC-CARD-02: дитина — ім'я й email опікуна", () => {
    expect(
      clientOptionLabel({ full_name: "Client Seven", client_type: "Child", email: null, guardian_email: "guardian7@example.test" }),
    ).toBe("Client Seven (guardian: guardian7@example.test)");
  });
});

describe("filterClients", () => {
  const six = { full_name: "Client Six", email: "client6@example.test", guardian_email: null };
  const seven = { full_name: "Client Seven", email: null, guardian_email: "guardian7@example.test" };
  const all = [six, seven];

  it("AC-CARD-02: дитину знаходять за email опікуна — повним чи його частиною, без урахування регістру й пробілів по краях", () => {
    expect(filterClients(all, "guardian7@example.test")).toEqual([seven]);
    expect(filterClients(all, "  GUARDIAN7 ")).toEqual([seven]);
  });

  it("AC-CARD-02: дорослого — за іменем чи власним email; в дорослого немає email опікуна, у дитини — власного", () => {
    expect(filterClients(all, "six")).toEqual([six]);
    expect(filterClients(all, "client6@")).toEqual([six]);
    expect(filterClients(all, "seven")).toEqual([seven]);
  });

  it("AC-CARD-02: порожній запит лишає всіх, запит без збігів — нікого; спецсимволи шукаються буквально", () => {
    expect(filterClients(all, "")).toEqual(all);
    expect(filterClients(all, "   ")).toEqual(all);
    expect(filterClients(all, "nobody")).toEqual([]);
    expect(filterClients(all, "a,b)(or=")).toEqual([]);
  });
});
