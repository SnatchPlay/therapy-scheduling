"use client";

import { useActionState, useState } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { MESSAGES, type MessageCode } from "@/lib/messages";
import { type CardFormState, createClientCard } from "../actions";

// Поля, які стосуються повідомлення: їм ставимо aria-invalid, щоб помилку було видно й скрінрідеру, а не лише в Alert.
const FIELDS_OF: Partial<Record<MessageCode, string[]>> = {
  INVALID_CLIENT: ["full_name", "email"],
  INVALID_CLIENT_NAME: ["full_name"],
  CLIENT_EXISTS: ["email"],
  INVALID_BIRTH_DATE: ["birth_date"],
  INVALID_LANGUAGE: ["session_language"],
  INVALID_GUARDIAN: ["guardian_name", "guardian_email"],
};

function Field({
  name,
  label,
  invalid,
  value,
  placeholder,
}: {
  name: string;
  label: string;
  invalid: boolean;
  value: string | undefined;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      {/* Без required і type=email: браузер інакше сам відмовив би своїм текстом, а текст відмови дає база (AC-CARD-03). */}
      <Input
        id={name}
        name={name}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        autoComplete="off"
        aria-required="true"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "card-form-error" : undefined}
      />
    </div>
  );
}

export function ClientCardForm() {
  const [state, action, pending] = useActionState(createClientCard, null);
  // React 19 скидає форму після кожної дії й губить значення керованих і вже змонтованих полів (select). Тому поля
  // монтуємо наново з результатом дії: ключ міняється, коли міняються повернені значення чи код, і defaultValue
  // (а з ним тип клієнта й мова) береться з них заново. Без цього після відмови «Child» ставав «Adult» (AC-CARD-03).
  const key = state ? `${state.code}:${JSON.stringify(state.values)}` : "initial";
  return <CardFields key={key} state={state} action={action} pending={pending} />;
}

function CardFields({
  state,
  action,
  pending,
}: {
  state: CardFormState;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const values = state?.values ?? {};
  const [type, setType] = useState(values.client_type === "Child" ? "Child" : "Adult");
  const invalid = (name: string) => FIELDS_OF[state?.code ?? "UNEXPECTED"]?.includes(name) ?? false;

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4">
      {state ? (
        <Alert variant="destructive" id="card-form-error">
          <AlertTitle>{MESSAGES[state.code]}</AlertTitle>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="client_type">Client type</Label>
        <NativeSelect id="client_type" name="client_type" value={type} onChange={(e) => setType(e.target.value)}>
          <NativeSelectOption value="Adult">Adult</NativeSelectOption>
          <NativeSelectOption value="Child">Child</NativeSelectOption>
        </NativeSelect>
      </div>
      <Field name="full_name" label="Name" invalid={invalid("full_name")} value={values.full_name} />
      {type === "Adult" ? <Field name="email" label="Email" invalid={invalid("email")} value={values.email} /> : null}
      <Field
        name="birth_date"
        label="Date of birth (YYYY-MM-DD)"
        invalid={invalid("birth_date")}
        value={values.birth_date}
        placeholder="YYYY-MM-DD"
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="session_language">Session language</Label>
        <NativeSelect
          id="session_language"
          name="session_language"
          defaultValue={values.session_language ?? ""}
          aria-required="true"
          aria-invalid={invalid("session_language") || undefined}
          aria-describedby={invalid("session_language") ? "card-form-error" : undefined}
        >
          <NativeSelectOption value="" disabled>
            Choose a language
          </NativeSelectOption>
          <NativeSelectOption value="English">English</NativeSelectOption>
          <NativeSelectOption value="Spanish">Spanish</NativeSelectOption>
        </NativeSelect>
      </div>
      {type === "Child" ? (
        <>
          <Field name="guardian_name" label="Guardian name" invalid={invalid("guardian_name")} value={values.guardian_name} />
          <Field name="guardian_email" label="Guardian email" invalid={invalid("guardian_email")} value={values.guardian_email} />
        </>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          Create client
        </Button>
      </div>
    </form>
  );
}
