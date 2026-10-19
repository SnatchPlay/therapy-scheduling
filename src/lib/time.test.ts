import { describe, expect, it } from "vitest";
import { formatPracticeDateTime, isIsoDate, practiceDate } from "./time";

describe("Час практики America/Los_Angeles", () => {
  it("AC-HOLD-02: утримання 2026-11-02 14:30 показує «Held until 2026-11-03 14:30»", () => {
    const created = new Date("2026-11-02T22:30:00Z"); // 2026-11-02 14:30 PST
    const heldUntil = new Date(created.getTime() + 1440 * 60_000);
    expect(formatPracticeDateTime(created)).toBe("2026-11-02 14:30");
    expect(`Held until ${formatPracticeDateTime(heldUntil)}`).toBe("Held until 2026-11-03 14:30");
  });

  it("перехід на зимовий час 2026-11-01: 1440 хвилин дають «Held until» на годину раніше (припущення PM)", () => {
    const created = new Date("2026-10-31T21:30:00Z"); // 2026-10-31 14:30 PDT
    const heldUntil = new Date(created.getTime() + 1440 * 60_000);
    expect(formatPracticeDateTime(heldUntil)).toBe("2026-11-01 13:30");
  });

  it("дата практики — за Лос-Анджелесом, а не за UTC", () => {
    expect(practiceDate(new Date("2026-11-04T06:30:00Z"))).toBe("2026-11-03");
  });

  it("неіснуюча дата в адресі не приймається", () => {
    expect(isIsoDate("2026-11-03")).toBe(true);
    expect(isIsoDate("2026-02-31")).toBe(false);
    expect(isIsoDate("2026-11-3")).toBe(false);
  });
});
