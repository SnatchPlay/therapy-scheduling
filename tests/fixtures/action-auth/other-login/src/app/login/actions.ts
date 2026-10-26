"use server";

import { getViewer } from "@/lib/supabase/viewer";

export async function login() {
  await getViewer();
}
