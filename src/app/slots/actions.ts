"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbMessageCode } from "@/lib/messages";
import { getViewer } from "@/lib/supabase/viewer";

/**
 * AC-HOLD-02…08, AC-HOLD-17: утримання слоту. Усі правила — у базі (hold_slot і тригер guard_new_hold): вони діють
 * і для прямого виклику через Data API. Тут — лише тип полів і переклад коду помилки бази в повідомлення.
 */
export async function holdSlot(formData: FormData) {
  // getViewer, а не requireRole: роль перевіряє hold_slot, і терапевт отримує текст PM
  // «Only schedulers and admins can hold slots.» (AC-HOLD-08), а не мовчазне перенаправлення.
  const { supabase } = await getViewer();
  const [slotId, clientId, therapist, day] = ["slot_id", "client_id", "therapist", "day"].map((k) => formData.get(k));
  const back = new URLSearchParams({
    therapist: typeof therapist === "string" ? therapist : "",
    day: typeof day === "string" ? day : "",
  });
  // Поля — лише текст: файл у полі форми інакше став би рядком «[object File]».
  if (typeof slotId !== "string" || typeof clientId !== "string") {
    back.set("msg", "UNEXPECTED");
    redirect(`/slots?${back}`);
  }

  const { error } = await supabase.rpc("hold_slot", { p_slot_id: slotId, p_client_id: clientId });
  if (error) {
    const code = dbMessageCode(error);
    // Непередбачена помилка — у лог сервера й на сторінку помилки (error.tsx), а не лише загальний текст.
    if (code === "UNEXPECTED") throw error;
    back.set("msg", code);
  } else {
    back.set("msg", "HELD");
  }
  revalidatePath("/slots");
  redirect(`/slots?${back}`);
}
