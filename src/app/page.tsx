import { redirect } from "next/navigation";
import { AppShell } from "@/app/_components/app-shell";
import { noticeFor } from "@/lib/messages";
import { getViewer, STAFF } from "@/lib/supabase/viewer";

// Головна — розвилка за роллю (матриця прав requirements/product.md).
export default async function Home() {
  const { role, email } = await getViewer();
  // design.md Р6: планувальник починає зі слотів, терапевт — з розкладу.
  if (role && STAFF.includes(role)) redirect("/slots");
  if (role === "therapist") redirect("/schedule");

  // AC-CARD-11: без ролі — лише повідомлення про відсутність доступу, жодних даних (на цю сторінку повертає requireRole).
  return <AppShell role={role} email={email} title="Therapy scheduling" notice={noticeFor("NO_ACCESS")} />;
}
