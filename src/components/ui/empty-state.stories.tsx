import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmptyState } from "./empty-state";

const meta = { title: "Feedback/EmptyState", component: EmptyState } satisfies Meta<typeof EmptyState>;
export default meta;

type Story = StoryObj<typeof meta>;

export const TitleAndNextStep: Story = {
  args: { title: "No holds yet.", children: "Held slots appear here until they are confirmed or run out." },
};

export const TitleOnly: Story = { args: { title: "No slots this week." } };
