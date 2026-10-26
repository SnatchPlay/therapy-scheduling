"use server";

import { getViewer } from "@/lib/supabase/viewer";

export async function bad() {
  return 1;
}

export async function good() {
  await getViewer();
}
