import { AppShell } from "@/app/_components/app-shell";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { noticeFor } from "@/lib/messages";
import { requireRole, STAFF } from "@/lib/supabase/viewer";
import { createClientCard } from "./actions";

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const { supabase, role, email } = await requireRole(...STAFF);
  const { msg } = await searchParams;

  const { data: clients, error } = await supabase.from("clients").select("id, full_name, email").order("full_name");
  if (error) throw error;

  return (
    <AppShell role={role} email={email} title="Clients" notice={noticeFor(msg)}>
      <form action={createClientCard} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="full_name">Name</Label>
          <Input id="full_name" name="full_name" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" />
        </div>
        <Button type="submit">Create client</Button>
      </form>
      {clients.length === 0 ? (
        <EmptyState title="No clients yet.">Create the first client card with the form above.</EmptyState>
      ) : (
        <Table>
          <TableCaption className="sr-only">Clients</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.full_name}</TableCell>
                <TableCell>{c.email}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AppShell>
  );
}
