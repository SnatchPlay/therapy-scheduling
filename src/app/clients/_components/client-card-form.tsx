"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { MESSAGES, type MessageCode } from "@/lib/messages";
import type { IntakeValues } from "@/lib/ai/intake";
import { type CardFormState, createClientCard, type IntakeDraftState, requestIntakeDraft } from "../actions";
import { IntakeDraftPanel } from "./intake-draft-panel";

// Повідомлення, що стосуються полів: текст показуємо під першим полем групи, а всім полям групи ставимо aria-invalid і
// aria-describedby на цей текст (AC-CARD-12: усі помилки одразу, кожна біля свого поля). Інші коди (відмова за правами,
// дублікат картки, збій) — загальні, їх показує Alert над формою.
const FIELDS_OF: Partial<Record<MessageCode, string[]>> = {
  INVALID_TYPE: ["client_type"],
  INVALID_CLIENT: ["full_name", "email"],
  INVALID_CLIENT_NAME: ["full_name"],
  CLIENT_EXISTS: ["email"],
  INVALID_BIRTH_DATE: ["birth_date"],
  INVALID_LANGUAGE: ["session_language"],
  INVALID_GUARDIAN: ["guardian_name", "guardian_email"],
};
const errorId = (code: MessageCode) => `error-${code}`;
const isFieldCode = (code: MessageCode) => code in FIELDS_OF;

/** Атрибути поля: invalid і посилання на повідомлення (одне чи кілька), що його стосуються. */
function describe(field: string, codes: MessageCode[]) {
  const ids = codes.filter((c) => FIELDS_OF[c]?.includes(field)).map(errorId);
  return { "aria-invalid": ids.length > 0 || undefined, "aria-describedby": ids.join(" ") || undefined };
}

function FieldErrors({ field, codes }: { field: string; codes: MessageCode[] }) {
  return codes
    .filter((c) => FIELDS_OF[c]?.[0] === field)
    .map((c) => (
      <p key={c} id={errorId(c)} className="text-sm text-destructive">
        {MESSAGES[c]}
      </p>
    ));
}

function Field({
  name,
  label,
  codes,
  value,
  placeholder,
}: {
  name: string;
  label: string;
  codes: MessageCode[];
  value: string | undefined;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={name}>{label}</Label>
      {/* Без required і type=email: браузер інакше сам відмовив би своїм текстом, а текст відмови дає база (AC-CARD-12). */}
      <Input
        id={name}
        name={name}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        autoComplete="off"
        aria-required="true"
        {...describe(name, codes)}
      />
      <FieldErrors field={name} codes={codes} />
    </div>
  );
}

/** Чернетка, застосована до форми; `forState` — результат createClientCard на мить застосування (див. ClientCardForm). */
type DraftSeed = { values: IntakeValues; forState: CardFormState; n: number };

export function ClientCardForm() {
  const [state, action, pending] = useActionState(createClientCard, null);
  const [draft, draftAction, drafting] = useActionState(requestIntakeDraft, null);
  // Чернетка (AC-INTAKE-01, 02) заповнює всю форму: застосовуємо її, коли з'явився новий результат із полями. Це «стан із
  // props» за документацією React: порівняння під час рендеру, без ефекту. Відмова чи «недоступний» (AC-INTAKE-06…08) нічого
  // не застосовують, і поля лишаються як були.
  const [seenDraft, setSeenDraft] = useState<IntakeDraftState>(null);
  const [seed, setSeed] = useState<DraftSeed | null>(null);
  if (draft !== seenDraft) {
    setSeenDraft(draft);
    if (draft?.kind === "draft") setSeed({ values: draft.values, forState: state, n: (seed?.n ?? 0) + 1 });
  }
  // Новіше з двох: чернетка, якщо після неї створення картки не повертало результату; інакше — результат createClientCard
  // (там уже поля, які планувальник виправив, і помилки).
  const seeded = seed && seed.forState === state ? seed : null;
  const values: Record<string, string> = seeded?.values ?? state?.values ?? {};
  const codes = seeded ? [] : (state?.codes ?? []);
  // React 19 скидає форму після кожної дії й губить значення керованих і вже змонтованих полів (select). Тому поля
  // монтуємо наново з результатом дії: ключ міняється, коли міняються повернені значення чи коди, і defaultValue
  // (а з ним тип клієнта й мова) береться з них заново. Без цього після відмови «Child» ставав «Adult» (AC-CARD-03).
  const key = seeded ? `draft:${seeded.n}` : state ? `${state.codes.join(",")}:${JSON.stringify(state.values)}` : "initial";
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <IntakeDraftPanel key={draft ? `${draft.kind}:${draft.message}:${draft.text}` : "initial"} state={draft} action={draftAction} pending={drafting} />
      <CardFields key={key} state={state} values={values} codes={codes} action={action} pending={pending} />
    </div>
  );
}

function CardFields({
  state,
  values,
  codes,
  action,
  pending,
}: {
  state: CardFormState;
  values: Record<string, string>;
  codes: MessageCode[];
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  const initialType = values.client_type === "Child" || values.client_type === "Adult" ? values.client_type : "";
  // Тип лише підказує, які поля показати; значення select — defaultValue, як у мови: React 19 після кожної дії скидає
  // форму до defaultValue, а керований value повторне надсилання тих самих даних перетворювало б на «Adult».
  const [type, setType] = useState(initialType);
  const form = useRef<HTMLFormElement>(null);
  // Після кожної відмови (форму змонтовано наново чи кнопка була вимкнена на час запиту) фокус губиться: ставимо його на
  // перше поле з помилкою, його текст читає скрінрідер через aria-describedby.
  useEffect(() => {
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-4">
      {codes.filter((c) => !isFieldCode(c)).map((c) => (
        <Alert key={c} variant="destructive" id={errorId(c)}>
          <AlertTitle>{MESSAGES[c]}</AlertTitle>
        </Alert>
      ))}
      <div className="flex flex-col gap-2">
        <Label htmlFor="client_type">Client type</Label>
        <NativeSelect
          id="client_type"
          name="client_type"
          defaultValue={initialType}
          onChange={(e) => setType(e.target.value)}
          aria-required="true"
          {...describe("client_type", codes)}
        >
          <NativeSelectOption value="" disabled>
            Choose a type
          </NativeSelectOption>
          <NativeSelectOption value="Adult">Adult</NativeSelectOption>
          <NativeSelectOption value="Child">Child</NativeSelectOption>
        </NativeSelect>
        <FieldErrors field="client_type" codes={codes} />
      </div>
      <Field name="full_name" label="Name" codes={codes} value={values.full_name} />
      {type === "Adult" ? <Field name="email" label="Email" codes={codes} value={values.email} /> : null}
      <Field
        name="birth_date"
        label="Date of birth (YYYY-MM-DD)"
        codes={codes}
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
          {...describe("session_language", codes)}
        >
          <NativeSelectOption value="" disabled>
            Choose a language
          </NativeSelectOption>
          <NativeSelectOption value="English">English</NativeSelectOption>
          <NativeSelectOption value="Spanish">Spanish</NativeSelectOption>
        </NativeSelect>
        <FieldErrors field="session_language" codes={codes} />
      </div>
      {type === "Child" ? (
        <>
          <Field name="guardian_name" label="Guardian name" codes={codes} value={values.guardian_name} />
          <Field name="guardian_email" label="Guardian email" codes={codes} value={values.guardian_email} />
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
