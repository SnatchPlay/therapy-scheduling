type Findable = { full_name: string; email: string | null; guardian_email: string | null };

/**
 * Пошук клієнта під час утримання (AC-CARD-02): за іменем або email, а дитину — і за email опікуна. Частина тексту,
 * без урахування регістру й пробілів по краях; порожній запит лишає всіх. Фільтр у застосунку, а не `ilike` до бази:
 * введений текст не потрапляє в умови PostgREST (там треба екранувати коми й дужки), а карток небагато.
 */
export function filterClients<T extends Findable>(clients: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return clients;
  return clients.filter((c) => [c.full_name, c.email].some((v) => v?.toLowerCase().includes(needle)));
}

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
