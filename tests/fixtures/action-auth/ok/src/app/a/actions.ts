"use server";

import { getViewer, requireRole as needRole } from "@/lib/supabase/viewer";

export type FormState = { code: string } | null;

// Об'єктний літерал у типі повернення, `$` в імені й коментар про .from( не збивають перевірку.
export async function create(_previous: FormState, formData: FormData): Promise<{ code: string } | null> {
  const { supabase } = await needRole("admin");
  await supabase.from("things").insert({ name: formData.get("name") });
  return null;
}

export async function $remove(formData: FormData, options: { force: boolean }) {
  const { supabase } = await getViewer();
  const text = "getViewer( не викликано } {";
  await supabase.rpc("remove_thing", { id: formData.get("id"), force: options.force, text });
}

export default async function fallback() {
  await getViewer();
}
