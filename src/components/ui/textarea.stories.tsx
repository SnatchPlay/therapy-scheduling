import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Label } from "./label";
import { Textarea } from "./textarea";

const meta = { title: "Forms/Textarea", component: Textarea } satisfies Meta<typeof Textarea>;
export default meta;

type Story = StoryObj<typeof meta>;

// Поле завжди з видимим Label (htmlFor = id): placeholder підпису не замінює.
export const WithLabel: Story = {
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor="request">Client request</Label>
      <Textarea {...args} id="request" defaultValue="Hi, I'm Client Ten, client10@example.test." />
    </div>
  ),
};

export const Empty: Story = {
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor="request-empty">Client request</Label>
      <Textarea {...args} id="request-empty" placeholder="Paste the client's message" />
    </div>
  ),
};

export const Invalid: Story = {
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor="request-invalid">Client request</Label>
      <Textarea {...args} id="request-invalid" aria-invalid="true" aria-describedby="request-error" />
      <span id="request-error" className="text-sm text-destructive">
        Paste the client&apos;s request.
      </span>
    </div>
  ),
};

export const Disabled: Story = {
  render: (args) => (
    <div className="flex max-w-sm flex-col gap-2">
      <Label htmlFor="request-disabled">Client request</Label>
      <Textarea {...args} id="request-disabled" defaultValue="Hi, I'm Client Ten." disabled />
    </div>
  ),
};
