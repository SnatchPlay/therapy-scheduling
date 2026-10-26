"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/supabase/viewer";

export async function late() {
  revalidatePath("/");
  await getViewer();
}
