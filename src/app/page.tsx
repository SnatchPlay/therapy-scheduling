import { redirect } from "next/navigation";
import { AppShell } from "@/app/_components/app-shell";
import { messageFor } from "@/lib/messages";
import { getViewer, STAFF } from "@/lib/supabase/viewer";

// Головна — розвилка за роллю (матриця прав requirements/product.md).
export default async function Home({ searchParams }: PageProps<"/">) {
  const { role, email } = await getViewer();
  const { msg } = await searchParams;
  // design.md Р6: планувальник починає зі слотів, терапевт — з розкладу.
  if (role && STAFF.includes(role)) redirect("/slots");
  if (role === "therapist") redirect("/schedule");

  return (
    <AppShell role={role} email={email} title="Therapy scheduling" message={messageFor(msg)}>
      <p className="text-sm text-zinc-500">
        Profile not found.
      </p>
    </AppShell>
  );
}
