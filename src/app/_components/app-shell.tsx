import { CalendarClock, CalendarDays, CalendarHeart, Hourglass, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import type { Notice } from "@/lib/messages";
import { cn } from "cn";
import { ALL_ROLES, type Role, STAFF } from "@/lib/supabase/viewer";
import { SignOutButton } from "./sign-out-button";

// Посилання за матрицею прав requirements/product.md: терапевт бачить свій розклад і своїх клієнтів.
const LINKS: { href: string; label: string; icon: LucideIcon; roles: readonly Role[] }[] = [
  { href: "/schedule", label: "Schedule", icon: CalendarDays, roles: ["therapist"] },
  { href: "/slots", label: "Slots", icon: CalendarClock, roles: STAFF },
  { href: "/holds", label: "Holds", icon: Hourglass, roles: STAFF },
  { href: "/clients", label: "Clients", icon: Users, roles: ALL_ROLES },
];

type Props = {
  role: Role | null;
  email: string | null;
  title: string;
  /** Підзаголовок під назвою сторінки: одне речення, що тут можна зробити. */
  description?: string;
  /** Головна дія сторінки (кнопка) праворуч від заголовка. */
  actions?: ReactNode;
  /** Маршрут сторінки: підсвічує її пункт у навігації (`aria-current="page"`). */
  current?: string;
  /** `wide` — для сіток, яким тісно в основній ширині (тижневий розклад). */
  width?: "default" | "wide";
  notice?: Notice;
  children?: ReactNode;
};

export function AppShell({ role, email, title, description, actions, current, width = "default", notice, children }: Props) {
  const links = LINKS.filter((l) => role && l.roles.includes(role));
  return (
    <div className="flex w-full flex-1 flex-col md:flex-row">
      {/* Один блок на всі ширини: на телефоні — верхня смуга (марка, користувач, пункти в рядок), від md — бічна панель. */}
      <aside className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-card px-4 py-3 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:flex-col md:flex-nowrap md:items-stretch md:gap-6 md:border-r md:border-b-0 md:px-3 md:py-5">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg px-2 py-1 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <CalendarHeart className="size-4" />
          </span>
          <span className="text-sm leading-tight font-semibold">
            Therapy
            <br className="hidden md:inline" /> scheduling
          </span>
        </Link>

        {links.length > 0 ? (
          <nav aria-label="Main" className="order-last flex w-full gap-1 overflow-x-auto md:order-none md:w-auto md:flex-1 md:flex-col md:overflow-visible">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={current === l.href ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring",
                  current === l.href ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <l.icon aria-hidden className="size-4 shrink-0" />
                {l.label}
              </Link>
            ))}
          </nav>
        ) : null}
        <div className="ml-auto flex min-w-0 items-center gap-3 md:ml-0 md:flex-col md:items-stretch md:gap-3 md:border-t md:border-border md:pt-4">
          <div className="flex min-w-0 items-center gap-3 px-1">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
              {(email ?? "?").slice(0, 2).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-col text-sm leading-tight" data-testid="viewer">
              <span className="truncate font-medium">{email}</span>
              <span className="text-xs text-muted-foreground capitalize">{role ?? "no role"}</span>
            </span>
          </div>
          <SignOutButton size="sm" className="md:w-full md:justify-start" />
        </div>

      </aside>

      <main className={cn("mx-auto flex min-w-0 w-full flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8", width === "wide" ? "max-w-6xl" : "max-w-4xl")}>
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-2xl font-semibold">{title}</h1>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
        </div>
        {notice ? (
          // Повідомлення приходить після redirect, тобто в новому документі: live region «status», що є вже під час
          // завантаження, скрінрідер зазвичай не озвучує, тому й успіх подаємо як alert.
          <Alert variant={notice.tone === "error" ? "destructive" : "default"} role="alert">
            <AlertTitle>{notice.text}</AlertTitle>
          </Alert>
        ) : null}
        {children}
      </main>
    </div>
  );
}
