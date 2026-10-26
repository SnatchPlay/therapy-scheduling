/** Підпис клієнта у виборі під час утримання: дорослий — з власним email, дитина — з email опікуна (AC-CARD-02). */
export function clientOptionLabel(client: {
  full_name: string;
  client_type: string;
  email: string | null;
  guardian_email: string | null;
}) {
  const contact = client.client_type === "Child" ? `guardian: ${client.guardian_email}` : client.email;
  return `${client.full_name} (${contact})`;
}
