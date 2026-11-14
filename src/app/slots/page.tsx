import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/app/_components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { clientOptionLabel, filterClients } from "@/lib/clients";
import { MESSAGES, noticeFor } from "@/lib/messages";
import { hasHoldableSlot, withSlotTimes } from "@/lib/slots";
import { ALL_ROLES, requireRole, STAFF } from "@/lib/supabase/viewer";
import { addDays, formatPracticeDateTime, formatPracticeTime, isIsoDate, practiceDate, weekdayName } from "@/lib/time";
import { holdSlot } from "./actions";

export default async function SlotsPage({ searchParams }: PageProps<"/slots">) {
  const { supabase, role, email } = await requireRole(...ALL_ROLES);
  const params = await searchParams;
  // AC-HOLD-44: терапевту за прямим посиланням (зокрема на слоти іншого терапевта) — відмова без даних; запитів до бази немає.
  if (!STAFF.includes(role)) return <AppShell role={role} email={email} current="/slots" title="Slots" notice={noticeFor("PAGE_FORBIDDEN")} />;

  const [therapistsResult, clientsResult] = await Promise.all([
    supabase.from("therapists").select("id, full_name").order("full_name"),
    supabase.from("clients").select("id, full_name, client_type, email, guardian_email").order("full_name"),
  ]);
  if (therapistsResult.error) throw therapistsResult.error;
  if (clientsResult.error) throw clientsResult.error;
  const therapists = therapistsResult.data;
  const clients = clientsResult.data;
  // AC-CARD-02: пошук клієнта за іменем чи email, дитини — і за email опікуна; список вибору в кожному слоті лише з знайдених.
  const find = typeof params.client === "string" ? params.client : "";
  const found = filterClients(clients, find);

  // Лише терапевт зі списку: довільний ?therapist= не доходить до бази.
  const therapistId = therapists.find((t) => t.id === params.therapist)?.id ?? therapists[0]?.id;
  const day = isIsoDate(params.day) ? params.day : practiceDate();

  const { data: slots, error } = therapistId
    ? await supabase.rpc("day_slots", { p_therapist_id: therapistId, p_day: day })
    : { data: [], error: null };
  if (error) throw error;
  const rows = withSlotTimes(slots);

  // Рядок-підсумок дня з наявних статусів слотів: «3 free · 1 held».
  const counts = Map.groupBy(rows, (r) => r.status);
  const summary = (["Free", "Held", "Confirmed"] as const)
    .filter((st) => counts.has(st))
    .map((st) => `${counts.get(st)?.length} ${st.toLowerCase()}`)
    .join(" · ");
  const dayHref = (d: string) => `/slots?${new URLSearchParams({ ...(therapistId ? { therapist: therapistId } : {}), day: d, ...(find ? { client: find } : {}) })}`;

  return (
    <AppShell role={role} email={email} current="/slots" title="Slots" description="Choose a therapist and a day, then hold a slot for a client." notice={noticeFor(params.msg)}>
      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4" method="get">
        <div className="flex flex-col gap-2">
          <Label htmlFor="therapist">Therapist</Label>
          <NativeSelect id="therapist" name="therapist" defaultValue={therapistId}>
            {therapists.map((t) => (
              <NativeSelectOption key={t.id} value={t.id}>
                {t.full_name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="day">Day</Label>
          <Input id="day" type="date" name="day" defaultValue={day} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="client">Find a client</Label>
          <Input id="client" name="client" defaultValue={find} placeholder="Name or email" autoComplete="off" />
        </div>
        <Button type="submit" variant="outline">
          Show slots
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">
          {weekdayName(day)} {day}
        </h2>
        <span className="text-sm text-muted-foreground">{summary || "No slots"}</span>
        <nav aria-label="Days" className="ml-auto flex items-center gap-2">
          <Link href={dayHref(addDays(day, -1))} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ChevronLeft aria-hidden />
            Previous day
          </Link>
          <Link href={dayHref(practiceDate())} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Today
          </Link>
          <Link href={dayHref(addDays(day, 1))} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Next day
            <ChevronRight aria-hidden />
          </Link>
        </nav>
      </div>

      {/* AC-HOLD-18, AC-HOLD-24, AC-HOLD-33: повідомлення, коли немає слоту, який ще можна утримати; слоти дня лишаються
          в списку. Слот, що вже почався й не утриманий, — «Past» (AC-HOLD-32): не вільний, його не утримати (AC-HOLD-07). */}
      {hasHoldableSlot(rows) ? null : (
        <p className="text-sm text-muted-foreground" data-testid="no-free-slots">
          {MESSAGES.NO_FREE_SLOTS}
        </p>
      )}

      {clients.length > 0 && found.length === 0 && rows.some((s) => s.holdable) ? (
        <p className="text-sm text-muted-foreground" data-testid="no-client-match">
          No clients match.
        </p>
      ) : null}

      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card text-sm">
        {rows.map((s) => (
          <li key={s.slot_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3" data-testid="slot">
            <span className="w-28 font-mono font-medium">
              {formatPracticeTime(s.starts_at)}–{formatPracticeTime(s.ends_at)}
            </span>
            <StatusBadge status={s.status} data-testid="slot-status" />
            {s.status === "Held" && s.held_until ? (
              <span>
                {s.client_name} · Held until {formatPracticeDateTime(s.held_until)}
              </span>
            ) : null}
            {s.status === "Confirmed" ? <span>{s.client_name}</span> : null}
            {s.holdable && clients.length === 0 ? (
              <Link href="/clients/new" className={buttonVariants({ variant: "link" }) + " ml-auto"}>
                Create a client first
              </Link>
            ) : null}
            {s.holdable && found.length > 0 ? (
              <form action={holdSlot} className="ml-auto flex gap-2">
                <input type="hidden" name="slot_id" value={s.slot_id} />
                <input type="hidden" name="therapist" value={therapistId ?? ""} />
                <input type="hidden" name="day" value={day} />
                {/* Порожній перший пункт: інакше required нічого не вимагає, і слот утримали б за першим клієнтом списку. */}
                <NativeSelect name="client_id" required defaultValue="" className="w-48 sm:w-64" aria-label={`Client for ${formatPracticeTime(s.starts_at)}`}>
                  <NativeSelectOption value="" disabled>
                    Choose a client
                  </NativeSelectOption>
                  {found.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {clientOptionLabel(c)}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Button type="submit">Hold</Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
