"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useSmokeCue } from "@/app/_components/smoke/smoke-backdrop";
import { Button } from "@/components/ui/button";

// Поки вхід триває, хрест на тлі виринає вперед; якщо вхід не вдався, повертається у фон. Після невдалого входу Next
// монтує сторінку заново (?error=…), тож rest іде й під час монтування — таймлайн пропускає його, якщо emerge не було.
export function SignInButton() {
  const { pending } = useFormStatus();
  const cue = useSmokeCue();

  useEffect(() => cue(pending ? "emerge" : "rest"), [pending, cue]);

  return (
    <Button type="submit" disabled={pending}>
      Sign in
    </Button>
  );
}
