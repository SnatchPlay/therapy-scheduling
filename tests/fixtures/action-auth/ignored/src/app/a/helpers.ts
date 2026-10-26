// Не "use server": це не публічний ендпойнт, правило його не стосується.
export async function loadThings(supabase: { from: (t: string) => unknown }) {
  return supabase.from("things");
}
