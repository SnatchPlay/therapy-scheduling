// Екран слотів дня: чи є слот, який ще можна утримати (holdable рахує база в public.slot_board).
export function hasHoldableSlot(rows: { holdable: boolean | null }[]): boolean {
  return rows.some((r) => r.holdable === true);
}

/** Колонки представлення в типах Supabase nullable; у slot_board слот і його час завжди є (з таблиці slots). */
export function withSlotTimes<T extends { slot_id: string | null; starts_at: string | null; ends_at: string | null }>(
  rows: readonly T[] | null,
) {
  return (rows ?? []).flatMap(({ slot_id, starts_at, ends_at, ...rest }) =>
    slot_id && starts_at && ends_at ? [{ ...rest, slot_id, starts_at, ends_at }] : [],
  );
}
