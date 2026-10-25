import { AppShell } from "@/app/_components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { MESSAGES, noticeFor } from "@/lib/messages";
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
    <AppShell role={role} email={email} title="Slots" notice={noticeFor(params.msg)}>
      <form className="flex flex-wrap items-end gap-3" method="get">
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
        <Button type="submit" variant="outline">
          Show slots
        </Button>
      </form>

      {/* AC-HOLD-18, AC-HOLD-24, AC-HOLD-33: повідомлення, коли немає слоту, який ще можна утримати; слоти дня лишаються
          в списку. Слот, що вже почався й не утриманий, — «Past» (AC-HOLD-32): не вільний, його не утримати (AC-HOLD-07). */}
      {hasHoldableSlot(rows) ? null : (
        <p className="text-sm text-muted-foreground" data-testid="no-free-slots">
          {MESSAGES.NO_FREE_SLOTS}
        </p>
      )}

      <ul className="flex flex-col divide-y divide-border text-sm">
        {rows.map((s) => (
          <li key={s.slot_id} className="flex flex-wrap items-center gap-4 py-3" data-testid="slot">
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
              <a href="/clients" className={buttonVariants({ variant: "link" }) + " ml-auto"}>
                Create a client first
              </a>
            ) : null}
            {s.holdable && clients.length > 0 ? (
              <form action={holdSlot} className="ml-auto flex gap-2">
                <input type="hidden" name="slot_id" value={s.slot_id} />
                <input type="hidden" name="therapist" value={therapistId ?? ""} />
                <input type="hidden" name="day" value={day} />
                {/* Порожній перший пункт: інакше required нічого не вимагає, і слот утримали б за першим клієнтом списку. */}
                <NativeSelect name="client_id" required defaultValue="" aria-label={`Client for ${formatPracticeTime(s.starts_at)}`}>
                  <NativeSelectOption value="" disabled>
                    Choose a client
                  </NativeSelectOption>
                  {clients.map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.full_name} ({c.email})
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
