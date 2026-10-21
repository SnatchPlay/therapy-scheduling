import { describe, expect, it } from "vitest";
import { addDays, formatPracticeDateTime, formatPracticeTime, isIsoDate, practiceDate, weekdayName, weekStart } from "./time";

describe("Час практики America/Los_Angeles", () => {
  // Самі 24 години рахує база (private.hold_expires_at, tests/db/holds-db.test.ts); тут — лише формат показу.
  it("формат РРРР-ММ-ДД ГГ:ХХ: 2026-11-02 14:30 + 1440 хвилин → «Held until 2026-11-03 14:30»", () => {
    const created = new Date("2026-11-02T22:30:00Z"); // 2026-11-02 14:30 PST
    const heldUntil = new Date(created.getTime() + 1440 * 60_000);
    expect(formatPracticeDateTime(created)).toBe("2026-11-02 14:30");
    expect(`Held until ${formatPracticeDateTime(heldUntil)}`).toBe("Held until 2026-11-03 14:30");
  });

  it("дата практики — за Лос-Анджелесом, а не за UTC", () => {
    expect(practiceDate(new Date("2026-11-04T06:30:00Z"))).toBe("2026-11-03");
  });

  it("час слоту — ГГ:ХХ, 24 години", () => {
    expect(formatPracticeTime(new Date("2026-11-03T22:05:00Z"))).toBe("14:05");
  });

  it("неіснуюча дата в адресі не приймається", () => {
    expect(isIsoDate("2026-11-03")).toBe(true);
    for (const value of ["2026-02-31", "2026-11-3", "x2026-11-03", "2026-11-03x", "0000-01-01", 20261103, undefined]) {
      expect(isIsoDate(value)).toBe(false);
    }
  });
});

describe("тиждень", () => {
  it("AC-HOLD-30: середа 2026-11-04 → тиждень з понеділка 2026-11-02; понеділок і неділя належать своєму тижню", () => {
    expect(weekStart("2026-11-04")).toBe("2026-11-02");
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
  });

  it("AC-HOLD-31: наступний тиждень — +7 днів, через межу місяця, року й перехід на зимовий час", () => {
    expect(addDays("2026-11-02", 7)).toBe("2026-11-09");
    expect(addDays("2026-11-02", -7)).toBe("2026-10-26");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
    // Перехід на зимовий час 2026-11-01 не зсуває календарних днів.
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });

  it("назва дня тижня для заголовка", () => {
    expect(weekdayName("2026-11-02")).toBe("Monday");
    expect(weekdayName("2026-11-08")).toBe("Sunday");
  });
});
