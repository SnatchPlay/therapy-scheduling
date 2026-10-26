import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Колонки картки для select: сторінки списку й картки читають одне й те саме. */
export const CLIENT_COLUMNS =
  "id, client_type, full_name, email, birth_date, session_language, guardian_name, guardian_email";

export type ClientCardData = {
  id: string;
  client_type: string;
  full_name: string;
  email: string | null;
  birth_date: string | null;
  session_language: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
};

// Картки зрізу 1 (лише ім'я й email) мають порожні поля анкети: «Not provided» (припущення PM).
const NOT_PROVIDED = "Not provided";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={value ? "font-medium" : "text-muted-foreground"}>{value ?? NOT_PROVIDED}</dd>
    </div>
  );
}

export function ClientCard({ client, linked = false }: { client: ClientCardData; linked?: boolean }) {
  return (
    <Card data-testid="client-card">
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-2">
          {linked ? (
            <Link href={`/clients/${client.id}`} className="text-primary underline underline-offset-4">
              {client.full_name}
            </Link>
          ) : (
            client.full_name
          )}
          <span className="text-sm font-normal text-muted-foreground">{client.client_type}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          {client.client_type === "Child" ? (
            <>
              <Field label="Guardian" value={client.guardian_name} />
              <Field label="Guardian email" value={client.guardian_email} />
            </>
          ) : (
            <Field label="Email" value={client.email} />
          )}
          <Field label="Date of birth" value={client.birth_date} />
          <Field label="Session language" value={client.session_language} />
        </dl>
      </CardContent>
    </Card>
  );
}
