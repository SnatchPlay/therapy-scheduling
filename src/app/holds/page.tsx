import { AppShell, buttonClass } from "@/app/_components/app-shell";
import { messageFor } from "@/lib/messages";
import { requireRole } from "@/lib/supabase/viewer";
import { formatPracticeDateTime } from "@/lib/time";
import { confirmHold } from "./actions";

// AC-HOLD-20: планувальник і адміністратор бачать усі утримання, зокрема «Expired».
export default async function HoldsPage({ searchParams }: PageProps<"/holds">) {
  const { supabase, role, email } = await requireRole("scheduler", "admin");
  const { msg } = await searchParams;

  const { data: holds, error } = await supabase
    .from("hold_list")
    .select("hold_id, therapist_name, starts_at, client_name, held_until, status")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (
    <AppShell role={role} email={email} title="Holds" message={messageFor(msg)}>
      <table className="w-full text-left text-sm">
        <thead className="text-zinc-500">
          <tr>
            <th className="py-2">Slot</th>
            <th className="py-2">Therapist</th>
            <th className="py-2">Client</th>
            <th className="py-2">Status</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {holds.map((h) => (
            <tr key={h.hold_id} className="border-t border-zinc-200 dark:border-zinc-800" data-testid="hold">
              <td className="py-2 font-mono">{h.starts_at ? formatPracticeDateTime(h.starts_at) : ""}</td>
              <td className="py-2">{h.therapist_name}</td>
              <td className="py-2">{h.client_name}</td>
              <td className="py-2">
                <span className="font-medium" data-testid="hold-status">
                  {h.status}
                </span>
                {h.status === "Held" && h.held_until ? ` · Held until ${formatPracticeDateTime(h.held_until)}` : null}
              </td>
              <td className="py-2 text-right">
                {h.status === "Held" && h.hold_id ? (
                  <form action={confirmHold}>
                    <input type="hidden" name="hold_id" value={h.hold_id} />
                    <button type="submit" className={buttonClass}>
                      Confirm
                    </button>
                  </form>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppShell>
  );
}
