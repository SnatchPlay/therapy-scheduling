"use server";

import { getViewer } from "@/lib/supabase/viewer";
import { adminClient } from "@/lib/supabase/admin";

export async function sneaky() {
  await adminClient().from("things").delete().neq("id", "");
  await getViewer();
}
