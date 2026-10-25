import Link from "next/link";
import { AppShell } from "@/app/_components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { noticeFor } from "@/lib/messages";
import { withSlotTimes } from "@/lib/slots";
import { requireRole } from "@/lib/supabase/viewer";
import { addDays, formatPracticeDateTime, formatPracticeTime, isIsoDate, practiceDate, weekdayName, weekStart } from "@/lib/time";

// AC-HOLD-30, AC-HOLD-31: розклад терапевта — тиждень (понеділок–неділя) з усіма його слотами й статусами; тижні
// перемикаються. AC-HOLD-09, AC-HOLD-21: лише власні слоти й утримання, без прострочених — це робить база (RLS holds,
// slots, therapists, clients і security_invoker представлень): запити нижче без жодного фільтра за терапевтом.
export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  const { supabase, role, email } = await requireRole("therapist");
  const params = await searchParams;
  const week = weekStart(isIsoDate(params.week) ? params.week : practiceDate());
  const previous = addDays(week, -7);
  const next = addDays(week, 7);

  const { data: me, error: meError } = await supabase.from("therapists").select("id, full_name").maybeSingle();
  if (meError) throw meError;

  const { data: slots, error } = me
    ? await supabase.rpc("slots_between", { p_therapist_id: me.id, p_from: week, p_to: next })
    : { data: [], error: null };
  if (error) throw error;
  // Слоти вже за часом; групуємо за днями практики, дні без слотів не показуємо.
  const days = Map.groupBy(withSlotTimes(slots), (s) => practiceDate(s.starts_at));

  return (
    <AppShell role={role} email={email} title="Schedule" notice={noticeFor(params.msg)}>
      {me ? null : (
        <p className="text-sm text-muted-foreground" role="status" data-testid="no-therapist">
          No therapist record is linked to your account.
        </p>
      )}

      <nav aria-label="Weeks" className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={`/schedule?week=${previous}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Previous week
        </Link>
        <span className="px-2 font-medium">
          {week} – {addDays(week, 6)}
        </span>
        <Link href={`/schedule?week=${next}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Next week
        </Link>
        <Link href="/schedule" className={buttonVariants({ variant: "ghost", size: "sm" }) + " ml-auto"}>
          This week
        </Link>
      </nav>

      {days.size === 0 && me ? <EmptyState title="No slots this week." /> : null}
      {[...days].map(([day, rows]) => (
        <section key={day} className="flex flex-col gap-1" aria-labelledby={`day-${day}`}>
          <h2 id={`day-${day}`} className="text-lg font-semibold">
            {weekdayName(day)} {day}
          </h2>
          <ul className="flex flex-col divide-y divide-border text-sm">
            {rows.map((s) => (
              <li key={s.slot_id} className="flex flex-wrap items-center gap-4 py-2" data-testid="slot">
                <span className="w-28 font-mono font-medium">
                  {formatPracticeTime(s.starts_at)}–{formatPracticeTime(s.ends_at)}
                </span>
                <StatusBadge status={s.status} data-testid="slot-status" />
                {s.client_name ? <span>{s.client_name}</span> : null}
                {s.held_until ? <span>Held until {formatPracticeDateTime(s.held_until)}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </AppShell>
  );
}
