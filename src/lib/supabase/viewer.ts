// Хто увійшов і з якою роллю. Роль — лише з public.profiles (не з user_metadata), сесія — через getClaims().
import { redirect } from "next/navigation";
import { createClient } from "./server";

const ROLES = ["admin", "scheduler", "therapist"] as const; // profiles_role_check (міграція roles_and_clients)
export type Role = (typeof ROLES)[number];

const isRole = (value: unknown): value is Role => ROLES.some((r) => r === value);

export async function getViewer() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("email, full_name, role")
    .eq("id", claims.sub)
    .maybeSingle();
  // Збій бази — помилка, а не «профіль не знайдено».
  if (error) throw error;

  return {
    supabase,
    id: claims.sub,
    email: profile?.email ?? claims.email ?? null,
    role: isRole(profile?.role) ? profile.role : null,
  };
}

/** Сторінка чи дія лише для цих ролей; інших повертаємо на головну (там — їхня сторінка). */
export async function requireRole(...roles: Role[]) {
  const viewer = await getViewer();
  if (!viewer.role || !roles.includes(viewer.role)) redirect("/");
  return { ...viewer, role: viewer.role };
}
