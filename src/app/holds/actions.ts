"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbMessageCode } from "@/lib/messages";
import { getViewer } from "@/lib/supabase/viewer";

/** AC-HOLD-12…14, AC-HOLD-19, AC-HOLD-22, AC-HOLD-23: підтвердження. Правила — у базі (confirm_hold і guard_confirm). */
export async function confirmHold(formData: FormData) {
  // Роль перевіряє confirm_hold: терапевт отримує «Only schedulers and admins can confirm holds.» (AC-HOLD-14).
  const { supabase } = await getViewer();
  const { error } = await supabase.rpc("confirm_hold", { p_hold_id: String(formData.get("hold_id") ?? "") });

  revalidatePath("/holds");
  redirect(`/holds?msg=${error ? dbMessageCode(error) : "CONFIRMED"}`);
}
