"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbMessageCode } from "@/lib/messages";
import { getViewer } from "@/lib/supabase/viewer";

/** AC-HOLD-02…08, AC-HOLD-17: утримання слоту. Усі правила — у базі (hold_slot і тригер guard_new_hold). */
export async function holdSlot(formData: FormData) {
  // Роль перевіряє hold_slot: терапевт отримує «Only schedulers and admins can hold slots.» (AC-HOLD-08).
  const { supabase } = await getViewer();
  const back = new URLSearchParams({
    therapist: String(formData.get("therapist") ?? ""),
    day: String(formData.get("day") ?? ""),
  });

  const { error } = await supabase.rpc("hold_slot", {
    p_slot_id: String(formData.get("slot_id") ?? ""),
    p_client_id: String(formData.get("client_id") ?? ""),
  });

  back.set("msg", error ? dbMessageCode(error) : "HELD");
  revalidatePath("/slots");
  redirect(`/slots?${back}`);
}
