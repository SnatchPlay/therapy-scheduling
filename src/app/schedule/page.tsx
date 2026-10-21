import { AppShell, buttonClass, inputClass } from "@/app/_components/app-shell";
import { messageFor } from "@/lib/messages";
import { withSlotTimes } from "@/lib/slots";
import { requireRole } from "@/lib/supabase/viewer";
import { formatPracticeDateTime, formatPracticeTime, isIsoDate, practiceDate } from "@/lib/time";

// AC-HOLD-09, AC-HOLD-21: терапевт бачить лише власні утримання й сеанси без прострочених. Це робить база (RLS holds,
// slots, therapists, clients і security_invoker представлень): запити нижче без жодного фільтра за терапевтом.
// Період списку PM ще не визначила (Sofiia-pm/therapy-scheduling-spec#9): до відповіді — усі утримання й сеанси.
export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  const { supabase, role, email } = await requireRole("therapist");
  const params = await searchParams;
  const day = isIsoDate(params.day) ? params.day : practiceDate();

  const [holdsResult, meResult] = await Promise.all([
    supabase
      .from("hold_list")
      .select("hold_id, starts_at, client_name, status, held_until")
      .order("starts_at"),
    supabase.from("therapists").select("id, full_name").maybeSingle(),
  ]);
  if (holdsResult.error) throw holdsResult.error;
  if (meResult.error) throw meResult.error;
  const holds = holdsResult.data;
  const me = meResult.data;

  const { data: slots, error } = me
    ? await supabase.rpc("day_slots", { p_therapist_id: me.id, p_day: day })
    : { data: [], error: null };
  if (error) throw error;
  const rows = withSlotTimes(slots);

  return (
    <AppShell role={role} email={email} title="Schedule" message={messageFor(params.msg)}>
      {me ? null : (
        <p role="status" data-testid="no-therapist">
          No therapist record is linked to your account.
        </p>
      )}

      <section className="flex flex-col gap-2" aria-labelledby="holds-heading">
        <h2 id="holds-heading" className="text-lg font-medium">
          Holds and sessions
        </h2>
        {holds.length === 0 ? (
          <p className="text-sm text-zinc-500">No holds or sessions.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            {holds.map((h) => (
              <li key={h.hold_id} className="flex flex-wrap gap-4 py-2" data-testid="schedule-item">
                <span className="w-36 font-mono">{h.starts_at ? formatPracticeDateTime(h.starts_at) : ""}</span>
                <span className="w-24 font-medium" data-testid="schedule-status">
                  {h.status}
                </span>
                <span>{h.client_name}</span>
                {h.held_until ? <span>Held until {formatPracticeDateTime(h.held_until)}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="slots-heading">
        <h2 id="slots-heading" className="text-lg font-medium">
          Slots
        </h2>
        <form method="get" className="flex items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Day
            <input type="date" name="day" defaultValue={day} className={inputClass} />
          </label>
          <button type="submit" className={buttonClass}>
            Show slots
          </button>
        </form>
        {rows.length === 0 && me ? <p className="text-sm text-zinc-500">No slots on this day.</p> : null}
        <ul className="flex flex-col divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {rows.map((s) => (
            <li key={s.slot_id} className="flex flex-wrap gap-4 py-2" data-testid="slot">
              <span className="w-28 font-mono">
                {formatPracticeTime(s.starts_at)}–{formatPracticeTime(s.ends_at)}
              </span>
              <span className="w-24 font-medium" data-testid="slot-status">
                {s.status}
              </span>
              {s.client_name ? <span>{s.client_name}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
