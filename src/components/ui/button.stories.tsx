import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";

const meta = {
  title: "Actions/Button",
  component: Button,
  args: { children: "Hold" },
  argTypes: {
    variant: { control: "select", options: ["default", "secondary", "outline", "ghost", "destructive", "link"] },
    size: { control: "inline-radio", options: ["default", "sm"] },
  },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

// Одна основна дія на екран (`default`); у рядку списку — одна на рядок (DESIGN.md, розділ 5).
export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary", children: "Show slots" } };
export const Outline: Story = { args: { variant: "outline", children: "Sign out" } };
export const Ghost: Story = { args: { variant: "ghost", children: "Previous week" } };
export const Destructive: Story = { args: { variant: "destructive", children: "Remove" } };
export const Link: Story = { args: { variant: "link", children: "Create a client first" } };
export const Small: Story = { args: { size: "sm", children: "Confirm" } };
export const Disabled: Story = { args: { disabled: true, children: "Confirm" } };
