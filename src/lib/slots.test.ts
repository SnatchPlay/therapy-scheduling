import { describe, expect, it } from "vitest";
import { withSlotTimes } from "./slots";

const row = (over: Partial<{ slot_id: string | null; starts_at: string | null; ends_at: string | null }>) => ({
  slot_id: "s1",
  starts_at: "2026-11-05T18:00:00Z",
  ends_at: "2026-11-05T19:00:00Z",
  status: "Free",
  ...over,
});

describe("withSlotTimes", () => {
  it("лишає повні рядки з усіма іншими колонками", () => {
    expect(withSlotTimes([row({})])).toEqual([row({})]);
  });

  it("відкидає рядок без слота чи часу; null дає порожній список", () => {
    expect(withSlotTimes([row({ slot_id: null }), row({ starts_at: null }), row({ ends_at: null })])).toEqual([]);
    expect(withSlotTimes(null)).toEqual([]);
  });
});
