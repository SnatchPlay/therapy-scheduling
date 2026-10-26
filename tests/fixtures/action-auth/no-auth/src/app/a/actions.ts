"use server";

import { createClient } from "@/lib/supabase/server";

export async function dropEverything() {
  const supabase = await createClient();
  await supabase.from("things").delete().neq("id", "");
}
