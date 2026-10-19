import { redirect } from "next/navigation";
import { AppShell } from "@/app/_components/app-shell";
import { getViewer, STAFF } from "@/lib/supabase/viewer";

// Головна — розвилка за роллю (матриця прав requirements/product.md).
export default async function Home() {
  const { role, email } = await getViewer();
  // design.md Р6: планувальник починає зі слотів.
  if (role && STAFF.includes(role)) redirect("/slots");

  return (
    <AppShell role={role} email={email} title="Therapy scheduling">
      <p className="text-sm text-zinc-500" data-testid="user-role">
        {role ? `Role: ${role}. Nothing to show yet.` : "Profile not found."}
      </p>
    </AppShell>
  );
}
