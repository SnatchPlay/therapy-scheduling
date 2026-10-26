import { AppShell } from "@/app/_components/app-shell";
import { ALL_ROLES, requireRole } from "@/lib/supabase/viewer";
import { ClientCardForm } from "../_components/client-card-form";

// Форму відкриває будь-яка роль: терапевт за прямим посиланням бачить її й після спроби створити — відмову бази
// (AC-CARD-06). Без ролі requireRole повертає на головну з повідомленням про відсутність доступу.
export default async function NewClientPage() {
  const { role, email } = await requireRole(...ALL_ROLES);
  return (
    <AppShell role={role} email={email} title="New client">
      <ClientCardForm />
    </AppShell>
  );
}
