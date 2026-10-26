"use server";

import { getViewer } from "./fake-viewer";

export async function lookalike() {
  await getViewer();
}
