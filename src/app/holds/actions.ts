"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbMessageCode } from "@/lib/messages";
import { getViewer } from "@/lib/supabase/viewer";

/**
 * AC-HOLD-12…14, AC-HOLD-19, AC-HOLD-22, AC-HOLD-23: підтвердження. Усі правила — у базі (confirm_hold і guard_confirm):
 * вони діють і для прямого запиту через Data API. Тут — лише тип поля і переклад коду помилки бази в повідомлення.
 */
export async function confirmHold(formData: FormData) {
  // getViewer, а не requireRole: роль перевіряє confirm_hold, і терапевт отримує текст PM
  // «Only schedulers and admins can confirm holds.» (AC-HOLD-14), а не мовчазне перенаправлення.
  const { supabase } = await getViewer();
  // Поле — лише текст: файл у полі форми інакше став би рядком «[object File]».
  const holdId = formData.get("hold_id");
  if (typeof holdId !== "string") redirect("/holds?msg=UNEXPECTED");

  const { error } = await supabase.rpc("confirm_hold", { p_hold_id: holdId });
  if (error) {
    const code = dbMessageCode(error);
    // Непередбачена помилка (зокрема HOLD_NOT_FOUND) — у лог сервера й на сторінку помилки (error.tsx).
    if (code === "UNEXPECTED") throw error;
    // /holds лише для staff: терапевта звідти перенаправило б на головну без тексту, тож текст — одразу там.
    redirect(code === "CONFIRM_FORBIDDEN" ? `/?msg=${code}` : `/holds?msg=${code}`);
  }
  revalidatePath("/holds");
  redirect("/holds?msg=CONFIRMED");
}

// mutation: дія без перевірки сесії — job «Server actions: сесія перевіряється» має почервоніти.
export async function purgeHolds() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  await supabase.from("holds").delete().neq("id", "");
}
