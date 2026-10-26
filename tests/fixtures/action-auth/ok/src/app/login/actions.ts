"use server";

import { createClient } from "@/lib/supabase/server";

// Вхід і вихід: сесії ще немає або її знищують.
export async function login(formData: FormData) {
  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email: String(formData.get("email")), password: "x" });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
