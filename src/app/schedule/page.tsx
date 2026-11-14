import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/app/_components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { noticeFor } from "@/lib/messages";
import { withSlotTimes } from "@/lib/slots";
import { requireRole } from "@/lib/supabase/viewer";
import { cn } from "cn";
import { addDays, formatPracticeDateTime, formatPracticeTime, isIsoDate, practiceDate, weekdayName, weekStart } from "@/lib/time";

// AC-HOLD-30, AC-HOLD-31: розклад терапевта — тиждень (понеділок–неділя) з усіма його слотами й статусами; тижні
// перемикаються. AC-HOLD-09, AC-HOLD-21: лише власні слоти й утримання, без прострочених — це робить база (RLS holds,
// slots, therapists, clients і security_invoker представлень): запити нижче без жодного фільтра за терапевтом.
// Смужка ліворуч — колір статусу з токенів (DESIGN.md, розділ 2); без статусу чи невідомий — нейтральна межа.
const SLOT_STRIPE: Record<string, string> = {
  Held: "border-l-status-held-foreground",
  Confirmed: "border-l-status-confirmed-foreground",
  Expired: "border-l-status-expired-foreground",
  Past: "border-l-status-past-foreground",
};

export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  const { supabase, role, email } = await requireRole("therapist");
  const params = await searchParams;
  const week = weekStart(isIsoDate(params.week) ? params.week : practiceDate());
  const today = practiceDate();
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
    <AppShell role={role} email={email} current="/schedule" width="wide" title="Schedule" description="Your week at a glance." notice={noticeFor(params.msg)}>
      {me ? null : (
        <p className="text-sm text-muted-foreground" role="status" data-testid="no-therapist">
          No therapist record is linked to your account.
        </p>
      )}

      <nav aria-label="Weeks" className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={`/schedule?week=${previous}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ChevronLeft aria-hidden />
          Previous week
        </Link>
        <Link href={`/schedule?week=${next}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Next week
          <ChevronRight aria-hidden />
        </Link>
        <span className="px-2 font-mono font-medium">
          {week} – {addDays(week, 6)}
        </span>
        <Link href="/schedule" className={buttonVariants({ variant: "ghost", size: "sm" }) + " ml-auto"}>
          This week
        </Link>
      </nav>

      {days.size === 0 && me ? <EmptyState title="No slots this week.">Use the week buttons above to check another week.</EmptyState> : null}
      {/* Дні — колонки на широкому екрані й стовпчик на вузькому; дні без слотів не показуємо. Слот — картка зі смужкою
          кольору статусу ліворуч: статус завжди ще й словом у StatusBadge. */}
      <div className="grid gap-x-4 gap-y-6 md:grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))]">
        {[...days].map(([day, rows]) => (
          <section key={day} className="flex min-w-0 flex-col gap-2" aria-labelledby={`day-${day}`}>
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <h2 id={`day-${day}`} className="text-base font-semibold">
                {weekdayName(day)} {day}
              </h2>
              {day === today ? <span className="rounded-sm bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">Today</span> : null}
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              {rows.map((s) => (
                <li key={s.slot_id} className={cn("flex flex-col gap-1.5 rounded-lg border border-l-4 bg-card p-3", SLOT_STRIPE[s.status ?? ""] ?? "border-l-border")} data-testid="slot">
                  <span className="font-mono font-medium">
                    {formatPracticeTime(s.starts_at)}–{formatPracticeTime(s.ends_at)}
                  </span>
                  <StatusBadge status={s.status} data-testid="slot-status" />
                  {s.client_name ? <span className="font-medium">{s.client_name}</span> : null}
                  {s.held_until ? <span className="text-xs text-muted-foreground">Held until {formatPracticeDateTime(s.held_until)}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
