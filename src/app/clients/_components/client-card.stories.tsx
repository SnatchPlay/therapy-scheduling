import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ClientCard } from "./client-card";

const meta = { title: "Clients/ClientCard", component: ClientCard } satisfies Meta<typeof ClientCard>;
export default meta;

type Story = StoryObj<typeof meta>;

const adult = {
  id: "c6",
  client_type: "Adult",
  full_name: "Client Six",
  email: "client6@example.test",
  birth_date: "1990-05-14",
  session_language: "English",
  guardian_name: null,
  guardian_email: null,
  insurance_status: "Not set",
};

export const Adult: Story = { args: { client: adult, linked: true } };

// Статус страхування (AC-INS-01…04): рядок «Insurance: <статус>» — текстом, не лише кольором; усі чотири значення.
export const InsuranceVerified: Story = { args: { client: { ...adult, insurance_status: "Verified" } } };
export const InsuranceNotAccepted: Story = { args: { client: { ...adult, insurance_status: "Not accepted" } } };
export const InsurancePrivatePay: Story = { args: { client: { ...adult, insurance_status: "Private pay" } } };

// Дитина: контакт — опікун, власного email немає (AC-CARD-02).
export const ChildWithGuardian: Story = {
  args: {
    client: {
      ...adult,
      id: "c7",
      client_type: "Child",
      full_name: "Client Seven",
      email: null,
      birth_date: "2015-03-02",
      session_language: "Spanish",
      guardian_name: "Guardian Seven",
      guardian_email: "guardian7@example.test",
    },
  },
};

// Картка зрізу 1: лише ім'я й email, решта — «Not provided».
export const Slice1Legacy: Story = {
  args: { client: { ...adult, id: "c1", full_name: "Client One", email: "client1@example.test", birth_date: null, session_language: null } },
};
