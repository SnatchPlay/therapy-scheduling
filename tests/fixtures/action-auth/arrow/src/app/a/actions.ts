"use server";

import { getViewer } from "@/lib/supabase/viewer";

export const create = async () => {
  await getViewer();
};

async function helper() {
  await getViewer();
}
export { helper };
export * from "./more";
export default helper;
