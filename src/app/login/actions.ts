"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Вхід email + пароль. Реєстрації в шаблоні немає: користувачів створює
// scripts/create-demo-users.mjs (Admin API), бо вбудований SMTP Supabase
// надсилає лише 2 листи/год і лише членам команди проєкту.
export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Не показуємо текст помилки Auth: він може підказати, чи існує email.
    redirect("/login?error=invalid");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

// Останній крок виходу (SignOutButton): сесію вже закрив браузерний клієнт, а тут, коли /login уже поточна сторінка,
// revalidatePath("/", "layout") очищає кеш сторінок Next у браузері (revalidatePath.md у документації Next): без цього
// «Назад» показав би попередню сторінку з даними з пам'яті. auth.signOut() тут — на випадок, якщо cookie сесії ще є.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}
