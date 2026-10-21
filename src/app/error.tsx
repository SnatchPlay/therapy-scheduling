"use client"; // Межа помилок — лише клієнтський компонент (node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md)

import { useEffect } from "react";
import { MESSAGES } from "@/lib/messages";

// Збій запиту до бази (сторінки кидають error) — повідомлення, а не порожній список.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-16">
      <p role="alert" className="text-sm">
        {MESSAGES.UNEXPECTED}
      </p>
      <button type="button" onClick={() => retry()} className="self-start rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">
        Try again
      </button>
    </main>
  );
}
