import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { setInsuranceStatus } from "../actions";

// Значення, які можна позначити: «Not set» лише початковий і в списку його немає (припущення PM; правило — у базі).
const SETTABLE = ["Verified", "Not accepted", "Private pay"];

/** Форма зміни статусу страхування (AC-INS-02, 03): лише для планувальника й адміністратора, терапевту її не показуємо (AC-INS-04). */
export function InsuranceStatusForm({ clientId, current }: { clientId: string; current: string }) {
  return (
    <form action={setInsuranceStatus} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="insurance_status">Insurance status</Label>
        {/* Порожній перший пункт: інакше required нічого не вимагає, і зберігся б перший статус списку. */}
        <NativeSelect
          id="insurance_status"
          name="insurance_status"
          required
          defaultValue={SETTABLE.includes(current) ? current : ""}
        >
          <NativeSelectOption value="" disabled>
            Choose a status
          </NativeSelectOption>
          {SETTABLE.map((status) => (
            <NativeSelectOption key={status} value={status}>
              {status}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <Button type="submit">Save</Button>
    </form>
  );
}
