import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatusBadge } from "./status-badge";

const meta = { title: "Status/StatusBadge", component: StatusBadge } satisfies Meta<typeof StatusBadge>;
export default meta;

type Story = StoryObj<typeof meta>;

// Статус — слово з бази + знак + колір: зрозумілий і без кольору (DESIGN.md, розділ 2).
export const AllStatuses: Story = {
  args: { status: "Free" },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      {["Free", "Held", "Confirmed", "Expired", "Past"].map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  ),
};

// Невідомий статус не має «вільного» вигляду: слово лишається, вигляд нейтральний.
export const Unknown: Story = { args: { status: null } };
