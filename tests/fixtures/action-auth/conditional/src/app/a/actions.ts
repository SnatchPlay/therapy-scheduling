"use server";

import { getViewer } from "@/lib/supabase/viewer";
import { adminClient } from "@/lib/supabase/admin";

export async function maybe(formData: FormData) {
  if (formData.get("check")) {
    await getViewer();
  }
  await adminClient().from("things").delete().neq("id", "");
}
