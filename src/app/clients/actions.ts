"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { askModel } from "@/lib/ai/draft";
import { buildOutcome, todayInPractice, type IntakeValues } from "@/lib/ai/intake";
import { clientErrorCode, INTAKE_MESSAGES, MESSAGES, toMessageCode, type ClientType, type MessageCode } from "@/lib/messages";
import { getViewer, STAFF } from "@/lib/supabase/viewer";

/** Результат дії для форми: коди повідомлень (усі одразу) і введені значення (у форму їх повертає дія, а не адреса: персональні дані не в URL). */
export type CardFormState = { codes: MessageCode[]; values: Record<string, string> } | null;

const FIELDS = [
  "client_type",
  "full_name",
  "email",
  "birth_date",
  "session_language",
  "guardian_name",
  "guardian_email",
] as const;

/** Помилка для логу без `details` бази: там рядок із персональними даними картки (ім'я, email, дата народження). */
const unexpected = (what: string, error: { code?: string; message?: string }) => new Error(`${what}: ${error.code} ${error.message}`);

/**
 * AC-CARD-01, 02, 03, 06, 12, 13; AC-HOLD-10, 11, 15, 16, 39, 41: картка клієнта з анкети. Правила (тип, непорожнє ім'я,
 * формат email, дата РРРР-ММ-ДД не з майбутнього, мова зі списку, опікун дитини, право створювати картку) — лише в базі:
 * client_card_errors повертає всі помилки одразу (AC-CARD-12), а обмеження, тригер, унікальні індекси й RLS таблиці clients
 * лишаються останньою брамою для прямого запису через Data API. Тут — лише тип полів і переклад кодів у повідомлення.
 */
export async function createClientCard(_previous: CardFormState, formData: FormData): Promise<CardFormState> {
  const { supabase, role } = await getViewer();
  if (!role) redirect("/");

  // Значення форми — лише текст: файл у полі інакше став би іменем «[object File]».
  const values: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  const card: Record<string, string> = { ...values, birth_date: values.birth_date.trim() };

  const { data: errors, error: validationError } = await supabase.rpc("client_card_errors", { p_card: card });
  if (validationError) throw unexpected("client_card_errors", validationError);
  if (errors.length > 0) return { codes: errors.map(toMessageCode), values };

  // Після перевірки тип — «Adult» або «Child».
  const type = card.client_type as ClientType;
  const { error } = await supabase.from("clients").insert({
    client_type: type,
    full_name: card.full_name,
    birth_date: card.birth_date,
    session_language: card.session_language,
    ...(type === "Child"
      ? { guardian_name: card.guardian_name, guardian_email: card.guardian_email }
      : { email: card.email }),
  });

  if (error) {
    const code = clientErrorCode(error, type);
    // Непередбачена помилка — у лог сервера й на сторінку помилки (error.tsx), а не лише загальний текст.
    if (code === "UNEXPECTED") throw unexpected("insert into clients", error);
    return { codes: [code], values };
  }

  revalidatePath("/clients");
  redirect("/clients?msg=CLIENT_CREATED");
}

/**
 * AC-INS-02, 03, 05: статус перевірки страхування. Хто змінює (планувальник, адміністратор) і які значення дозволені
 * («Not set» повернути не можна) — лише в базі: політика clients_update_insurance_staff і check таблиці (ADR 0005). Тут —
 * лише тип полів і переклад результату: збереженням вважаємо рівно один зачеплений рядок. Терапевт, чужа чи неіснуюча
 * картка дають нуль рядків, а «Insurance status saved.» без збереження було б неправдою (AC-INS-05).
 */
export async function setInsuranceStatus(formData: FormData) {
  const { supabase, role } = await getViewer();
  if (!role) redirect("/");

  const clientId = formData.get("client_id");
  const status = formData.get("insurance_status");
  if (typeof clientId !== "string" || typeof status !== "string") redirect("/clients?msg=UNEXPECTED");

  const { data, error } = await supabase
    .from("clients")
    .update({ insurance_status: status })
    .eq("id", clientId)
    .select("id");
  // Збій бази й відмова політики для недозволеного значення — у лог сервера й на сторінку помилки (error.tsx).
  if (error) throw unexpected("update clients.insurance_status", error);

  const page = `/clients/${encodeURIComponent(clientId)}`;
  if (data.length !== 1) redirect(`${page}?msg=UNEXPECTED`);

  revalidatePath("/clients");
  revalidatePath(page);
  redirect(`${page}?msg=INSURANCE_SAVED`);
}

/** Результат запиту чернетки для панелі над формою: повідомлення, введений текст і (для чернетки) значення полів форми. */
export type IntakeDraftState =
  | { kind: "draft"; message: string; text: string; values: IntakeValues }
  | { kind: "refused" | "unavailable"; message: string; text: string }
  | null;

/** Довжина тексту звернення: вимога PM, «Припущення» (поле більшого не приймає). */
const MAX_REQUEST_LENGTH = 2000;

/**
 * AC-INTAKE-01…09: чернетка картки з тексту звернення (design.md, Р30–Р33). Дія лише ПОВЕРТАЄ чернетку у форму: вона не
 * торкається бази (картку створює людина через createClientCard з правилами й RLS), не має інструментів запису й не
 * виконує вказівок з тексту. Роль перевіряємо до виклику моделі: інакше терапевт чи будь-хто, хто пройшов вхід, витрачав би
 * денний ліміт безкоштовних запитів. Порожній текст і текст довший за ліміт до моделі не йдуть (припущення розробника, Р33).
 */
export async function requestIntakeDraft(_previous: IntakeDraftState, formData: FormData): Promise<IntakeDraftState> {
  const { role } = await getViewer();
  if (!role) redirect("/");

  const value = formData.get("text");
  const text = typeof value === "string" ? value : "";
  if (!STAFF.includes(role)) return { kind: "refused", message: MESSAGES.CARD_FORBIDDEN, text };
  if (!text.trim() || text.length > MAX_REQUEST_LENGTH) return { kind: "refused", message: INTAKE_MESSAGES.DRAFT_REFUSED, text };

  const today = todayInPractice();
  // Модуль із ключем (`server-only`) вантажимо лише тут: сторінки й тести, що імпортують цей файл, його не тягнуть.
  const { productModel } = await import("@/lib/ai/openrouter");
  const model = productModel();
  const result = model ? await askModel(text, today, model) : undefined;
  if (!result?.ok) {
    // Причина збою — у лог сервера (текст звернення туди не потрапляє); користувач бачить лише «недоступний» (AC-INTAKE-08).
    console.error(`intake draft unavailable: ${result ? result.reason : "no model key"}`);
    return { kind: "unavailable", message: INTAKE_MESSAGES.ASSISTANT_UNAVAILABLE, text };
  }

  const outcome = buildOutcome(result.draft, today);
  return outcome.kind === "draft"
    ? { kind: "draft", message: outcome.message, text, values: outcome.values }
    : { kind: "refused", message: outcome.message, text };
}
