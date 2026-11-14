import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Колонки картки для select: сторінки списку й картки читають одне й те саме. */
export const CLIENT_COLUMNS =
  "id, client_type, full_name, email, birth_date, session_language, guardian_name, guardian_email, insurance_status";

export type ClientCardData = {
  id: string;
  client_type: string;
  full_name: string;
  email: string | null;
  birth_date: string | null;
  session_language: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  insurance_status: string;
};

// Картки зрізу 1 (лише ім'я й email) мають порожні поля анкети: «Not provided» (припущення PM).
const NOT_PROVIDED = "Not provided";

// Статус страхування → вигляд бейджа (лише візуальне відображення варіантів DESIGN.md; слово завжди в тексті).
const INSURANCE_VARIANT = { Verified: "confirmed", "Not accepted": "expired", "Private pay": "past" } as const;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={value ? "font-medium" : "text-muted-foreground"}>{value ?? NOT_PROVIDED}</dd>
    </div>
  );
}

export function ClientCard({ client, linked = false }: { client: ClientCardData; linked?: boolean }) {
  const variant = Object.hasOwn(INSURANCE_VARIANT, client.insurance_status) ? INSURANCE_VARIANT[client.insurance_status as keyof typeof INSURANCE_VARIANT] : "free";
  return (
    <Card data-testid="client-card" className="gap-4">
      <CardHeader>
        <CardTitle role="heading" aria-level={2} className="flex items-center gap-3">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground">
            {initials(client.full_name)}
          </span>
          <span className="flex min-w-0 flex-col">
            {linked ? (
              <Link href={`/clients/${client.id}`} className="truncate text-primary underline-offset-4 hover:underline">
                {client.full_name}
              </Link>
            ) : (
              <span className="truncate">{client.full_name}</span>
            )}
            <span className="text-xs font-normal text-muted-foreground">{client.client_type}</span>
          </span>
          {/* «Insurance: <статус>» одним текстом, не лише кольором (припущення PM, AC-INS-01…04). */}
          <Badge variant={variant} className="ml-auto" data-testid="insurance-status">
            {`Insurance: ${client.insurance_status}`}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
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
