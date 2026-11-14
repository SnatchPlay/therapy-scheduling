import { Plus } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/app/_components/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MESSAGES, noticeFor } from "@/lib/messages";
import { ALL_ROLES, requireRole, STAFF } from "@/lib/supabase/viewer";
import { CLIENT_COLUMNS, ClientCard, type ClientCardData } from "./_components/client-card";

// Планувальник і адміністратор бачать усі картки, терапевт — лише своїх клієнтів: хто «свій», вирішує RLS таблиці clients
// (AC-CARD-04, 08, 10), тут запит однаковий для всіх ролей.
export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const { supabase, role, email } = await requireRole(...ALL_ROLES);
  const { msg } = await searchParams;

  const { data, error } = await supabase.from("clients").select(CLIENT_COLUMNS).order("full_name").order("id");
  if (error) throw error;
  const clients: ClientCardData[] = data;
  const isStaff = STAFF.includes(role);

  return (
    <AppShell
      role={role}
      email={email}
      current="/clients"
      width="wide"
      title="Clients"
      description={isStaff ? "All client cards." : "Your clients."}
      notice={noticeFor(msg)}
      actions={
        isStaff ? (
          <Link href="/clients/new" className={buttonVariants()}>
            <Plus aria-hidden />
            New client
          </Link>
        ) : undefined
      }
    >
      {clients.length === 0 ? (
        <EmptyState title={isStaff ? MESSAGES.NO_CLIENTS_STAFF : MESSAGES.NO_CLIENTS} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {clients.map((c) => (
            <li key={c.id}>
              <ClientCard client={c} linked />
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
