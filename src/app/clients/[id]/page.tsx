import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/app/_components/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { noticeFor } from "@/lib/messages";
import { ALL_ROLES, requireRole, STAFF } from "@/lib/supabase/viewer";
import { CLIENT_COLUMNS, ClientCard } from "../_components/client-card";

// 22P02: id в адресі не є uuid — такої картки теж немає.
const INVALID_ID = "22P02";

// Картку віддає лише RLS: чужа й неіснуюча картка — нуль рядків. Терапевт у обох випадках бачить ту саму відмову без
// даних (AC-CARD-05, 08): інакше за адресами можна було б дізнатися, хто є клієнтом практики. Для планувальника й
// адміністратора неіснуюча картка — 404.
export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const { supabase, role, email } = await requireRole(...ALL_ROLES);
  const { id } = await params;

  const { data, error } = await supabase.from("clients").select(CLIENT_COLUMNS).eq("id", id).maybeSingle();
  if (error && error.code !== INVALID_ID) throw error;

  if (!data) {
    notFound();
    return (
      <AppShell role={role} email={email} title="Client" notice={noticeFor("CLIENT_ACCESS_DENIED")}>
        <div>
          <Link href="/clients" className={buttonVariants({ variant: "outline" })}>
            Back to clients
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell role={role} email={email} title="Client">
      <ClientCard client={data} />
      <div>
        <Link href="/clients" className={buttonVariants({ variant: "outline" })}>
          Back to clients
        </Link>
      </div>
    </AppShell>
  );
}
