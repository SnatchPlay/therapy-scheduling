import { CalendarHeart } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "./actions";
import { SignInButton } from "./sign-in-button";

const ERRORS: Record<string, string> = {
  missing: "Enter your email and password.",
  invalid: "Wrong email or password.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <CalendarHeart className="size-5" />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="font-semibold">Therapy scheduling</span>
          <span className="text-sm text-muted-foreground">Sign in to your practice</span>
        </div>
      </div>
      {/* Картка, а не голе тло: позаду хрест з диму, а текст форми має лишатися контрастним. */}
      <Card className="gap-6 p-6">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <form action={login} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          {message ? (
            <Alert variant="destructive">
              <AlertTitle>{message}</AlertTitle>
            </Alert>
          ) : null}
          <SignInButton />
        </form>
      </Card>
    </main>
  );
}
