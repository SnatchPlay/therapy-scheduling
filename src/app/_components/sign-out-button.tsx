"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { useSmokeCue } from "@/app/_components/smoke/smoke-backdrop";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Size = ComponentProps<typeof Button>["size"];

// Вихід — у браузері, не server action: server action, що видаляє cookie, змушує Next перемалювати поточну сторінку
// (node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md), а сторінка без сесії одразу йде на
// /login — раніше, ніж хрест перекриє екран. signOut браузерного клієнта відкликає сесію в Supabase Auth і видаляє
// cookie; на сторінку входу переводить SmokeBackdrop (cue «leave»), щойно хрест перекрив екран. Помилка виходу —
// у межу помилок (error.tsx), сесія тоді лишається.
export function SignOutButton({ size }: { size?: Size }) {
  const cue = useSmokeCue();

  async function leave() {
    cue("summon");
    const { error } = await createClient().auth.signOut();
    if (error) throw error;
    cue("leave");
  }

  return (
    <form action={leave}>
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
