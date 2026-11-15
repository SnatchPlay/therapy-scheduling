"use client";

import { useState } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { IntakeDraftState } from "../actions";

/** Довжина тексту звернення: вимога PM, «Припущення». Дія перевіряє її ще раз на сервері. */
const MAX_REQUEST_LENGTH = 2000;

/**
 * AC-INTAKE-01…08: панель чернетки над формою нової картки — окрема форма зі своєю дією, тож її результат не скидає поля
 * картки (у відмовах, AC-INTAKE-06…08, вони лишаються як були). Панель лише просить чернетку; картку створює «Create client».
 */
export function IntakeDraftPanel({
  state,
  action,
  pending,
}: {
  state: IntakeDraftState;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  // Керований textarea: React 19 після дії скидає лише некеровані поля, тож текст лишається без перемонтування панелі.
  // Перемонтування (key) лишало в DOM стару копію форми поруч із новою: на проді було дві панелі й два #intake_text.
  const [text, setText] = useState(state?.text ?? "");
  return (
    <form action={action} className="flex flex-col gap-2">
      <Label htmlFor="intake_text">Client request</Label>
      {/* Текст нікуди не зберігаємо: він живе лише в цьому полі й іде в дію. */}
      <Textarea
        id="intake_text"
        name="text"
        maxLength={MAX_REQUEST_LENGTH}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
        aria-describedby="intake_hint"
      />
      <p id="intake_hint" className="text-sm text-muted-foreground">
        Don&apos;t paste diagnoses or other health details: name, date of birth, language and contacts are enough.
      </p>
      {state ? (
        <Alert variant={state.kind === "draft" ? "default" : "destructive"}>
          <AlertTitle>{state.message}</AlertTitle>
        </Alert>
      ) : null}
      <div>
        <Button type="submit" variant="secondary" disabled={pending || text.trim().length === 0}>
          Draft from request
        </Button>
      </div>
    </form>
  );
}
