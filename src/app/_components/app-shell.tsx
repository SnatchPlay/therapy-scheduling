import Link from "next/link";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import type { Notice } from "@/lib/messages";
import { type Role, STAFF } from "@/lib/supabase/viewer";

// Посилання за матрицею прав requirements/product.md: терапевт бачить лише свій розклад.
const LINKS: { href: string; label: string; roles: readonly Role[] }[] = [
  { href: "/slots", label: "Slots", roles: STAFF },
  { href: "/holds", label: "Holds", roles: STAFF },
  { href: "/clients", label: "Clients", roles: STAFF },
  { href: "/schedule", label: "Schedule", roles: ["therapist"] },
];

export function AppShell({
  role,
  email,
  title,
  notice,
  children,
}: {
  role: Role | null;
  email: string | null;
  title: string;
  notice?: Notice;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-center gap-4 border-b border-border pb-4 text-sm">
        <nav className="flex flex-wrap gap-2">
          {LINKS.filter((l) => role && l.roles.includes(role)).map((l) => (
            <Link key={l.href} href={l.href} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto text-muted-foreground" data-testid="viewer">
          {email} · {role ?? "no role"}
        </span>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <main className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {notice ? (
          <Alert variant={notice.tone === "error" ? "destructive" : "default"} role={notice.tone === "error" ? "alert" : "status"}>
            <AlertTitle>{notice.text}</AlertTitle>
          </Alert>
        ) : null}
        {children}
      </main>
    </div>
  );
}
