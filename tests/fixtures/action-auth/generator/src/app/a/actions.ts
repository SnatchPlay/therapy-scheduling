"use server";

import { getViewer } from "@/lib/supabase/viewer";

export async function* stream() {
  await getViewer();
  yield 1;
}
