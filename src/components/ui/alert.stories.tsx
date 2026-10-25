import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Alert, AlertTitle } from "./alert";

const meta = { title: "Feedback/Alert", component: Alert } satisfies Meta<typeof Alert>;
export default meta;

type Story = StoryObj<typeof meta>;

// Роль за варіантом: default — status, destructive — alert (повідомлення після redirect в AppShell — завжди alert).
export const Info: Story = {
  render: () => (
    <Alert>
      <AlertTitle>Hold confirmed.</AlertTitle>
    </Alert>
  ),
};

export const Error: Story = {
  render: () => (
    <Alert variant="destructive">
      <AlertTitle>This slot is no longer available.</AlertTitle>
    </Alert>
  ),
};
