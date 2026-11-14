import Link from "next/link";
import { AppShell } from "@/app/_components/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { noticeFor } from "@/lib/messages";
import { ALL_ROLES, requireRole, STAFF } from "@/lib/supabase/viewer";
import { CLIENT_COLUMNS, ClientCard } from "../_components/client-card";
import { InsuranceStatusForm } from "../_components/insurance-status-form";

// 22P02: id в адресі не є uuid — такої картки теж немає.
const INVALID_ID = "22P02";

// Картку віддає лише RLS: чужа й неіснуюча картка — нуль рядків. Терапевт у обох випадках бачить ту саму відмову без
// даних (AC-CARD-05, 08, 16): інакше за адресами можна було б дізнатися, хто є клієнтом практики. Планувальник і
// адміністратор бачать усі картки, тож нуль рядків для них — картки немає (AC-CARD-16).
export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const { supabase, role, email } = await requireRole(...ALL_ROLES);
  const { id } = await params;
  const { msg } = await searchParams;

  const { data, error } = await supabase.from("clients").select(CLIENT_COLUMNS).eq("id", id).maybeSingle();
  if (error && error.code !== INVALID_ID) throw error;

  if (!data) {
    return (
      <AppShell
        role={role}
        email={email}
        current="/clients"
        title="Client"
        notice={noticeFor(STAFF.includes(role) ? "CLIENT_NOT_FOUND" : "CLIENT_ACCESS_DENIED")}
      >
        <div>
          <Link href="/clients" className={buttonVariants({ variant: "outline" })}>
            Back to clients
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role} email={email} current="/clients" title="Client" notice={noticeFor(msg)}>
      <ClientCard client={data} />
      {/* Статус змінюють лише планувальник і адміністратор (AC-INS-02…04); право перевіряє й база (ADR 0005). */}
      {STAFF.includes(role) ? <InsuranceStatusForm clientId={data.id} current={data.insurance_status} /> : null}
      <div>
        <Link href="/clients" className={buttonVariants({ variant: "outline" })}>
          Back to clients
        </Link>
      </div>
    </AppShell>
  );
}
