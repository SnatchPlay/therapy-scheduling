// Екран слотів дня: чи є слот, який ще можна утримати (holdable рахує база в public.slot_board).
export function hasHoldableSlot(rows: { holdable: boolean | null }[]): boolean {
  return rows.some((r) => r.holdable === true);
}
