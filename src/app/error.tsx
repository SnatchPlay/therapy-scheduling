"use client"; // Межа помилок — лише клієнтський компонент (node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md)

import { useEffect } from "react";
import { signOut } from "@/app/login/actions";
import { MESSAGES } from "@/lib/messages";

// Збій запиту до бази (сторінки кидають error) — повідомлення, а не порожній список.
// `retry`, не `reset`: у Next 16.4 `retry` стабільний з v16.3.0 і перезапитує дані сегмента, а `reset` лише
// перемальовує без нового запиту (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md).
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    // Як у прикладі документації Next: у production текст серверної помилки вже замінено загальним із `digest`.
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-16">
      <p role="alert" className="text-sm">
        {MESSAGES.UNEXPECTED}
      </p>
      <div className="flex gap-3">
        <button type="button" onClick={() => retry()} className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">
          Try again
        </button>
        {/* Збій профілю повторюється на кожній сторінці: вихід має бути доступний і тут. */}
        <form action={signOut}>
          <button type="submit" className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
