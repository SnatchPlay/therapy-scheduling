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
    <AppShell role={role} email={email} title="Clients" notice={noticeFor(msg)}>
      {isStaff ? (
        <div>
          <Link href="/clients/new" className={buttonVariants()}>
            New client
          </Link>
        </div>
      ) : null}
      {clients.length === 0 ? (
        <EmptyState title={isStaff ? MESSAGES.NO_CLIENTS_STAFF : MESSAGES.NO_CLIENTS} />
      ) : (
        <ul className="flex flex-col gap-4">
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
