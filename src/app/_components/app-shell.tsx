import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { type Role, STAFF } from "@/lib/supabase/viewer";

// Посилання за матрицею прав requirements/product.md: терапевт бачить лише свій розклад.
const LINKS: { href: string; label: string; roles: readonly Role[] }[] = [
  { href: "/slots", label: "Slots", roles: STAFF },
  { href: "/holds", label: "Holds", roles: STAFF },
  { href: "/clients", label: "Clients", roles: STAFF },
];

export function AppShell({
  role,
  email,
  title,
  message,
  children,
}: {
  role: Role | null;
  email: string | null;
  title: string;
  message?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-center gap-4 border-b border-zinc-200 pb-4 text-sm dark:border-zinc-800">
        <nav className="flex flex-wrap gap-4">
          {LINKS.filter((l) => role && l.roles.includes(role)).map((l) => (
            <Link key={l.href} href={l.href} className="font-medium underline-offset-4 hover:underline">
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto text-zinc-500" data-testid="viewer">
          {email} · {role ?? "no role"}
        </span>
        <form action={signOut}>
          <button type="submit" className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700">
            Sign out
          </button>
        </form>
      </header>
      <main className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {message ? (
          <p role="alert" className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {message}
          </p>
        ) : null}
        {children}
      </main>
    </div>
  );
}

export const inputClass = "rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
export const buttonClass = "rounded bg-foreground px-3 py-2 text-sm font-medium text-background";
