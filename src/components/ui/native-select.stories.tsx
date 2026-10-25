import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Label } from "./label";
import { NativeSelect, NativeSelectOption } from "./native-select";

const meta = { title: "Forms/NativeSelect", component: NativeSelect } satisfies Meta<typeof NativeSelect>;
export default meta;

type Story = StoryObj<typeof meta>;

// Перший пункт порожній і недоступний: інакше `required` нічого не вимагає (DESIGN.md, розділ 5).
export const ChooseAClient: Story = {
  render: (args) => (
    <div className="flex max-w-xs flex-col gap-2">
      <Label htmlFor="client">Client</Label>
      <NativeSelect {...args} id="client" name="client_id" required defaultValue="">
        <NativeSelectOption value="" disabled>
          Choose a client
        </NativeSelectOption>
        <NativeSelectOption value="c1">client1 (client1@example.test)</NativeSelectOption>
        <NativeSelectOption value="c2">client2 (client2@example.test)</NativeSelectOption>
      </NativeSelect>
    </div>
  ),
};
