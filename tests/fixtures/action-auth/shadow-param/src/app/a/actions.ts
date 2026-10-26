"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/supabase/viewer";

export async function refresh(getViewer: () => Promise<unknown> = async () => undefined) {
  await getViewer();
  revalidatePath("/clients");
}

export async function destructured({ requireRole }: { requireRole: () => Promise<unknown> }) {
  await requireRole();
}
