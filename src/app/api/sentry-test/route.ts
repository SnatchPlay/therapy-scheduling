import { requireRole } from "@/lib/supabase/viewer";

/** Навмисна помилка для перевірки Sentry: лише адміністратор; інші йдуть на головну до того, як щось станеться. */
export async function GET() {
  await requireRole("admin");
  throw new Error("Sentry test: intentional error from /api/sentry-test");
}
