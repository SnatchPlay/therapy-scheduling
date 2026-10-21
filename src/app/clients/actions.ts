"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientErrorCode } from "@/lib/messages";
import { requireRole, STAFF } from "@/lib/supabase/viewer";

/** AC-HOLD-10, 11, 15, 16: картка клієнта. Перевіряє база (обмеження clients), тут — лише переклад помилки в код. */
export async function createClientCard(formData: FormData) {
  const { supabase } = await requireRole(...STAFF);

  const { error } = await supabase.from("clients").insert({
    full_name: String(formData.get("full_name") ?? ""),
    email: String(formData.get("email") ?? ""),
  });

  if (error) {
    const code = clientErrorCode(error);
    // Непередбачена помилка — у лог сервера й на сторінку помилки (error.tsx), а не лише загальний текст.
    if (code === "UNEXPECTED") throw error;
    redirect(`/clients?msg=${code}`);
  }

  revalidatePath("/clients");
  redirect("/clients?msg=CLIENT_CREATED");
}
