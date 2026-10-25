import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "./table";

const meta = { title: "Surfaces/Table", component: Table } satisfies Meta<typeof Table>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Holds: Story = {
  render: () => (
    <Table>
      <TableCaption className="sr-only">Holds</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Slot</TableHead>
          <TableHead>Therapist</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-mono font-medium">2026-12-15 10:00</TableCell>
          <TableCell>Therapist One</TableCell>
          <TableCell>client1</TableCell>
          <TableCell>
            <StatusBadge status="Confirmed" />
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-mono font-medium">2026-12-16 11:00</TableCell>
          <TableCell>Therapist Two</TableCell>
          <TableCell>client2</TableCell>
          <TableCell>
            <span className="flex items-center gap-2">
              <StatusBadge status="Held" />
              <span>Held until 2026-12-17 09:30</span>
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
