import { describe, expect, it } from "vitest";
import { clientErrorCode, MESSAGES, messageFor } from "./messages";

// Коди й тексти помилок Postgres — як їх повертає PostgREST для обмежень міграції roles_and_clients.
describe("clientErrorCode", () => {
  it.each([
    [{ code: "23505", message: 'duplicate key value violates unique constraint "clients_email_key"' }, "CLIENT_EXISTS"],
    [{ code: "23514", message: 'new row for relation "clients" violates check constraint "clients_full_name_check"' }, "INVALID_CLIENT"],
    [{ code: "23514", message: 'new row for relation "clients" violates check constraint "clients_email_check"' }, "INVALID_CLIENT"],
    // Те саме обмеження, але інший код — не наш випадок.
    [{ code: "23505", message: 'violates check constraint "clients_email_check"' }, "UNEXPECTED"],
    [{ code: "23514", message: 'violates unique constraint "clients_email_key"' }, "UNEXPECTED"],
    // Інші обмеження й помилки без тексту — загальне повідомлення.
    [{ code: "23505", message: 'violates unique constraint "profiles_email_key"' }, "UNEXPECTED"],
    [{ code: "23514", message: 'violates check constraint "profiles_role_check"' }, "UNEXPECTED"],
    [{ code: "23505" }, "UNEXPECTED"],
    [{ code: "23514" }, "UNEXPECTED"],
    [{ message: "fetch failed" }, "UNEXPECTED"],
  ])("%o → %s", (error, code) => {
    expect(clientErrorCode(error)).toBe(code);
  });
});

describe("messageFor", () => {
  it("відомий код → текст", () => {
    expect(messageFor("CLIENT_EXISTS")).toBe(MESSAGES.CLIENT_EXISTS);
  });

  it("невідомий код, код з прототипу чи не рядок → нічого", () => {
    for (const value of ["NOPE", "toString", "", undefined, ["CLIENT_EXISTS"]]) expect(messageFor(value)).toBeUndefined();
  });
});
