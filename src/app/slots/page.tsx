import { AppShell, buttonClass, inputClass } from "@/app/_components/app-shell";
import { MESSAGES, messageFor } from "@/lib/messages";
import { hasHoldableSlot, withSlotTimes } from "@/lib/slots";
import { requireRole, STAFF } from "@/lib/supabase/viewer";
import { formatPracticeDateTime, formatPracticeTime, isIsoDate, practiceDate } from "@/lib/time";
import { holdSlot } from "./actions";

export default async function SlotsPage({ searchParams }: PageProps<"/slots">) {
  const { supabase, role, email } = await requireRole(...STAFF);
  const params = await searchParams;

  const [therapistsResult, clientsResult] = await Promise.all([
    supabase.from("therapists").select("id, full_name").order("full_name"),
    supabase.from("clients").select("id, full_name, email").order("full_name"),
  ]);
  if (therapistsResult.error) throw therapistsResult.error;
  if (clientsResult.error) throw clientsResult.error;
  const therapists = therapistsResult.data;
  const clients = clientsResult.data;

  // Лише терапевт зі списку: довільний ?therapist= не доходить до бази.
  const therapistId = therapists.find((t) => t.id === params.therapist)?.id ?? therapists[0]?.id;
  const day = isIsoDate(params.day) ? params.day : practiceDate();

  const { data: slots, error } = therapistId
    ? await supabase.rpc("day_slots", { p_therapist_id: therapistId, p_day: day })
    : { data: [], error: null };
  if (error) throw error;
  const rows = withSlotTimes(slots);

  return (
    <AppShell role={role} email={email} title="Slots" message={messageFor(params.msg)}>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-sm">
          Therapist
          <select name="therapist" defaultValue={therapistId} className={inputClass}>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Day
          <input type="date" name="day" defaultValue={day} className={inputClass} />
        </label>
        <button type="submit" className={buttonClass}>
          Show slots
        </button>
      </form>

      {/* AC-HOLD-18, AC-HOLD-24 (відповідь PM Sofiia-pm/therapy-scheduling-spec#4): повідомлення, коли немає слоту,
          який ще можна утримати; слоти дня лишаються в списку. Слот, що вже почався й не утриманий, вільним для
          повідомлення не рахуємо — його не утримати (AC-HOLD-07); PM цей підвипадок не визначила (docs/spec-reading.md). */}
      {hasHoldableSlot(rows) ? null : <p data-testid="no-free-slots">{MESSAGES.NO_FREE_SLOTS}</p>}

      <ul className="flex flex-col divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        {rows.map((s) => (
          <li key={s.slot_id} className="flex flex-wrap items-center gap-4 py-3" data-testid="slot">
            <span className="w-28 font-mono">
              {formatPracticeTime(s.starts_at)}–{formatPracticeTime(s.ends_at)}
            </span>
            <span className="w-24 font-medium" data-testid="slot-status">
              {s.status}
            </span>
            {s.status === "Held" && s.held_until ? (
              <span>
                {s.client_name} · Held until {formatPracticeDateTime(s.held_until)}
              </span>
            ) : null}
            {s.status === "Confirmed" ? <span>{s.client_name}</span> : null}
            {s.holdable && clients.length === 0 ? (
              <a href="/clients" className="ml-auto underline">
                Create a client first
              </a>
            ) : null}
            {s.holdable && clients.length > 0 ? (
              <form action={holdSlot} className="ml-auto flex gap-2">
                <input type="hidden" name="slot_id" value={s.slot_id} />
                <input type="hidden" name="therapist" value={therapistId ?? ""} />
                <input type="hidden" name="day" value={day} />
                {/* Порожній перший пункт: інакше required нічого не вимагає, і слот утримали б за першим клієнтом списку. */}
                <select
                  name="client_id"
                  required
                  defaultValue=""
                  aria-label={`Client for ${formatPracticeTime(s.starts_at)}`}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Choose a client
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.email})
                    </option>
                  ))}
                </select>
                <button type="submit" className={buttonClass}>
                  Hold
                </button>
              </form>
            ) : null}
            {s.status === "Free" && !s.holdable ? <span className="text-zinc-500">Started</span> : null}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
