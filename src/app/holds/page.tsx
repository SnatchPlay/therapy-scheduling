import { AppShell } from "@/app/_components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { noticeFor } from "@/lib/messages";
import { requireRole, STAFF } from "@/lib/supabase/viewer";
import { formatPracticeDateTime } from "@/lib/time";
import { confirmHold } from "./actions";

// AC-HOLD-20, 28, 29, 37, 38, 42: список утримань — лише «Held» і «Expired» зі слотом, що ще не почався (підтверджені
// сеанси й утримання зі слотом, що почався, зникають; старе прострочене утримання зникає після повторного утримання тим
// самим клієнтом): це робить hold_list. Порядок — за часом слоту від найближчого.
export default async function HoldsPage({ searchParams }: PageProps<"/holds">) {
  const { supabase, role, email } = await requireRole(...STAFF);
  const { msg } = await searchParams;

  const { data: holds, error } = await supabase
    .from("hold_list")
    .select("hold_id, therapist_name, starts_at, client_name, held_until, status")
    .order("starts_at")
    // Рівний час слоту (два записи на один слот): без другого ключа порядок між перезавантаженнями міг би мінятися.
    .order("hold_id");
  if (error) throw error;

  return (
    <AppShell role={role} email={email} title="Holds" notice={noticeFor(msg)}>
      {holds.length === 0 ? (
        <EmptyState title="No holds yet.">Held slots appear here until they are confirmed or run out.</EmptyState>
      ) : (
        <Table>
          <TableCaption className="sr-only">Holds</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Slot</TableHead>
              <TableHead>Therapist</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holds.map((h) => (
              <TableRow key={h.hold_id} data-testid="hold">
                <TableCell className="font-mono font-medium">{h.starts_at ? formatPracticeDateTime(h.starts_at) : ""}</TableCell>
                <TableCell>{h.therapist_name}</TableCell>
                <TableCell>{h.client_name}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={h.status} data-testid="hold-status" />
                    {h.status === "Held" && h.held_until ? <span>Held until {formatPracticeDateTime(h.held_until)}</span> : null}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {h.status === "Held" && h.hold_id ? (
                    <form action={confirmHold}>
                      <input type="hidden" name="hold_id" value={h.hold_id} />
                      <Button
                        type="submit"
                        size="sm"
                        aria-label={`Confirm hold for ${h.client_name} at ${h.starts_at ? formatPracticeDateTime(h.starts_at) : ""}`}
                      >
                        Confirm
                      </Button>
                    </form>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AppShell>
  );
}
