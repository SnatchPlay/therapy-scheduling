import { getViewer } from "@/lib/supabase/viewer";
import { adminClient } from "@/lib/supabase/admin";

export default async function Page() {
  await getViewer();

  async function evil() {
    "use server";
    await adminClient().from("things").delete().neq("id", "");
  }

  return <form action={evil} />;
}
