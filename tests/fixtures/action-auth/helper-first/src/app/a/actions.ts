"use server";

import { getViewer } from "@/lib/supabase/viewer";
import { wipe } from "./wipe";

export async function helperFirst() {
  await wipe();
  await getViewer();
}
