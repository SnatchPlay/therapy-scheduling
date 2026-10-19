import { AppShell, buttonClass, inputClass } from "@/app/_components/app-shell";
import { messageFor } from "@/lib/messages";
import { requireRole } from "@/lib/supabase/viewer";
import { createClientCard } from "./actions";

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const { supabase, role, email } = await requireRole("scheduler", "admin");
  const { msg } = await searchParams;

  const { data: clients, error } = await supabase.from("clients").select("id, full_name, email").order("full_name");
  if (error) throw error;

  return (
    <AppShell role={role} email={email} title="Clients" message={messageFor(msg)}>
      <form action={createClientCard} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input name="full_name" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input name="email" className={inputClass} />
        </label>
        <button type="submit" className={buttonClass}>
          Create client
        </button>
      </form>
      <table className="w-full text-left text-sm">
        <thead className="text-zinc-500">
          <tr>
            <th className="py-2">Name</th>
            <th className="py-2">Email</th>
          </tr>
        </thead>
        <tbody>
          {(clients ?? []).map((c) => (
            <tr key={c.id} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-2">{c.full_name}</td>
              <td className="py-2">{c.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}
