"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { signOut } from "@/app/login/actions";
import { useSmoke } from "@/app/_components/smoke/smoke-backdrop";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Size = ComponentProps<typeof Button>["size"];

// Вихід у три кроки, щоб хрест накрив саме робочу сторінку:
// 1. signOut браузерного клієнта одразу відкликає сесію в Supabase Auth і видаляє cookie. Не server action: server
//    action, що видаляє cookie, змушує Next перемалювати поточну сторінку (07-mutating-data.md у документації Next), і
//    сторінка без сесії пішла б на /login раніше, ніж хрест перекриє екран.
// 2. Хрест перекрив екран — SmokeBackdrop відкриває /login.
// 3. Уже на /login (публічна сторінка: proxy не перенаправляє запит) server action signOut очищає кеш сторінок Next,
//    інакше «Назад» показав би попередню сторінку з даними з пам'яті вкладки.
// Помилка кроку 1 — у межу помилок (error.tsx): cookie могли лишитись (не вдалося оновити токен) або бути видалені лише
// в браузері (сервер Auth недоступний); що саме — сторінка помилки не знає, тож на /login не переводимо.
export function SignOutButton({ size }: { size?: Size }) {
  const { cue, leave } = useSmoke();

  async function signOutWithCover() {
    cue("summon");
    const { error } = await createClient().auth.signOut();
    if (error) throw error;
    await leave(signOut);
  }

  return (
    <form action={signOutWithCover}>
      <SubmitButton size={size} />
    </form>
  );
}

// useFormStatus бачить стан лише всередині форми.
function SubmitButton({ size }: { size?: Size }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size={size} disabled={pending}>
      Sign out
    </Button>
  );
}
