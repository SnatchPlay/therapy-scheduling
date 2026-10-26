"use server";

import { getViewer } from "@/lib/supabase/viewer";
import { adminClient } from "@/lib/supabase/admin";

export async function fireAndForget() {
  getViewer();
  await adminClient().from("things").delete().neq("id", "");
}

export async function keepPromise() {
  const pending = getViewer();
  return pending;
}
