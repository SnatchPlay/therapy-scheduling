"use server";

import { getViewer } from "@/lib/supabase/viewer";

export enum Mode {
  A,
}

export class Thing {}

export function syncOne() {
  return getViewer();
}

export let counter = 0;
