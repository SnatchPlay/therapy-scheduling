import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./input";
import { Label } from "./label";

const meta = { title: "Forms/Input", component: Input } satisfies Meta<typeof Input>;
export default meta;

type Story = StoryObj<typeof meta>;

// Поле завжди з видимим Label (htmlFor = id): placeholder підпису не замінює.
export const WithLabel: Story = {
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor="email">Email</Label>
      <Input {...args} id="email" type="email" defaultValue="client1@example.test" />
    </div>
  ),
};

export const Invalid: Story = {
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor="name">Name</Label>
      <Input {...args} id="name" aria-invalid="true" aria-describedby="name-error" />
      <span id="name-error" className="text-sm text-destructive">
        Enter the client&apos;s name.
      </span>
    </div>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor="day">Day</Label>
      <Input {...args} id="day" type="date" defaultValue="2026-12-15" disabled />
    </div>
  ),
};
