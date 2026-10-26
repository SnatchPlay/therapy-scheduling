import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

const meta = { title: "UI/Card", component: Card } satisfies Meta<typeof Card>;
export default meta;

type Story = StoryObj<typeof meta>;

// Поверхня з межею border і радіусом 8 px (DESIGN.md, розділ 4); картку в картку не вкладаємо.
export const Default: Story = {
  render: (args) => (
    <Card {...args} className="max-w-sm">
      <CardHeader>
        <CardTitle>Client Six</CardTitle>
      </CardHeader>
      <CardContent>client6@example.test</CardContent>
    </Card>
  ),
};
