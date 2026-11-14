import { AppShell } from "@/app/_components/app-shell";
import { noticeFor } from "@/lib/messages";
import { ALL_ROLES, requireRole, STAFF } from "@/lib/supabase/viewer";
import { ClientCardForm } from "../_components/client-card-form";

// AC-CARD-06: терапевт за прямим посиланням одразу бачить відмову без форми; спробу створити картку в обхід цієї
// сторінки відхиляє база (RLS clients). Без ролі requireRole повертає на головну з повідомленням про відсутність доступу.
export default async function NewClientPage() {
  const { role, email } = await requireRole(...ALL_ROLES);
  if (!STAFF.includes(role)) {
    return <AppShell role={role} email={email} current="/clients" title="New client" notice={noticeFor("CARD_FORBIDDEN")} />;
  }
  return (
    <AppShell role={role} email={email} current="/clients" title="New client">
      <ClientCardForm />
    </AppShell>
  );
}
