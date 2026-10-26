"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clientErrorCode, type ClientType, type MessageCode } from "@/lib/messages";
import { getViewer, STAFF } from "@/lib/supabase/viewer";
import { isIsoDate } from "@/lib/time";

/** Результат дії для форми: код повідомлення й введені значення (у форму їх повертає дія, а не адреса: персональні дані не в URL). */
export type CardFormState = { code: MessageCode; values: Record<string, string> } | null;

const FIELDS = [
  "client_type",
  "full_name",
  "email",
  "birth_date",
  "session_language",
  "guardian_name",
  "guardian_email",
] as const;

/**
 * AC-CARD-01, 02, 03, 06; AC-HOLD-10, 11, 15, 16, 39, 41: картка клієнта з анкети. Правила (непорожнє ім'я, формат і
 * унікальність email, дата не з майбутнього, мова зі списку, опікун дитини, право створювати картку) перевіряє лише
 * база (обмеження, тригер і RLS clients): вони діють і для прямого запису через Data API, а друга копія в коді
 * розійшлася б із ними. Тут — лише тип полів, обов'язковість дати народження (база приймає картки зрізу 1 без неї) і
 * переклад помилки бази в код повідомлення. Роль не перевіряємо вручну: терапевту відмовляє RLS (AC-CARD-06).
 */
export async function createClientCard(_previous: CardFormState, formData: FormData): Promise<CardFormState> {
  const { supabase, role } = await getViewer();
  if (!role) redirect("/");

  // Значення форми — лише текст: файл у полі інакше став би іменем «[object File]».
  const values: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  const type: ClientType = values.client_type === "Child" ? "Child" : "Adult";
  values.client_type = type;

  // Дата народження обов'язкова в формі картки (AC-CARD-01) і має формат РРРР-ММ-ДД (припущення PM): база приймає ще й
  // `06.05.1990` (як 5 червня), `epoch`, `-infinity`. «Не з майбутнього» перевіряє база.
  // Терапевт дійде до бази й без дати: відмову за правами (AC-CARD-06) дає RLS раніше за обмеження, тож порожня форма
  // показує саме її. Без дати йде null, бо текст `''` база не прочитала б як дату ще до RLS.
  const birthDate = values.birth_date.trim();
  const hasDate = isIsoDate(birthDate);
  if (!hasDate && STAFF.includes(role)) return { code: "INVALID_BIRTH_DATE", values };

  const { error } = await supabase.from("clients").insert({
    client_type: type,
    full_name: values.full_name,
    birth_date: hasDate ? birthDate : null,
    session_language: values.session_language,
    ...(type === "Child"
      ? { guardian_name: values.guardian_name, guardian_email: values.guardian_email }
      : { email: values.email }),
  });

  if (error) {
    const code = clientErrorCode(error, type);
    // Непередбачена помилка — у лог сервера й на сторінку помилки (error.tsx), а не лише загальний текст.
    if (code === "UNEXPECTED") throw error;
    return { code, values };
  }

  revalidatePath("/clients");
  redirect("/clients?msg=CLIENT_CREATED");
}
