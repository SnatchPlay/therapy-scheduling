"use client";

import type { ComponentProps } from "react";
import { signOut } from "@/app/login/actions";
import { useSmokeCue } from "@/app/_components/smoke/smoke-backdrop";
import { Button } from "@/components/ui/button";

// Вихід іде на сервер одразу, а хрест тим часом збирається з диму й перекриває екран: анімація вихід не затримує.
export function SignOutButton({ size }: { size?: ComponentProps<typeof Button>["size"] }) {
  const cue = useSmokeCue();
  return (
    <form action={signOut} onSubmit={() => cue("summon")}>
      <Button type="submit" variant="outline" size={size}>
        Sign out
      </Button>
    </form>
  );
}
