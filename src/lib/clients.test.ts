import { describe, expect, it } from "vitest";
import { clientOptionLabel } from "./clients";

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
