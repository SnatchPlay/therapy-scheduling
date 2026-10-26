"use client"; // Межа помилок — лише клієнтський компонент (node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md)

import { useEffect } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/lib/messages";
import { SignOutButton } from "./_components/sign-out-button";
import { useSmokeCue } from "./_components/smoke/smoke-backdrop";

// Збій запиту до бази (сторінки кидають error) — повідомлення, а не порожній список.
// `retry`, не `reset`: у Next 16.4 `retry` стабільний з v16.3.0 і перезапитує дані сегмента, а `reset` лише
// перемальовує без нового запиту (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md).
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const cue = useSmokeCue();
  // Вхід чи вихід упав посеред анімації: хрест не має лишитись над повідомленням про помилку.
  useEffect(() => {
    cue("settle");
  }, [cue]);

  useEffect(() => {
    // Як у прикладі документації Next: у production текст серверної помилки вже замінено загальним із `digest`.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-16">
      <Alert variant="destructive">
        <AlertTitle>{MESSAGES.UNEXPECTED}</AlertTitle>
      </Alert>
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => retry()}>
          Try again
        </Button>
        {/* Збій профілю повторюється на кожній сторінці: вихід має бути доступний і тут. */}
        <SignOutButton />
      </div>
    </main>
  );
}
