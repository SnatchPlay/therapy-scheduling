import { redirect } from "next/navigation";
import { getViewer } from "@/lib/supabase/viewer";

// Головна — розвилка за роллю (матриця прав requirements/product.md).
export default async function Home() {
  const { role } = await getViewer();
  if (role === "scheduler" || role === "admin") redirect("/clients");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Therapy scheduling</h1>
      <p className="text-sm text-zinc-500" data-testid="user-role">
        {role ? `Role: ${role}. Nothing to show yet.` : "Profile not found."}
      </p>
    </main>
  );
}
