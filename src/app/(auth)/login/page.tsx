import { LogIn, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getAreas, getOutlets } from "@/lib/data/store";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  const outlets = getOutlets().length;
  const areas = getAreas().length;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* grid + ambient glow */}
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-32 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-lg bg-primary">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-foreground">Operation GWG</span>
        </div>
        <ThemeToggle />
      </div>

      {/* card */}
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card/80 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary shadow-sm">
            <LogIn className="size-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome Back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Please sign in to continue</p>
        </div>

        <LoginForm demoAccounts={[]} demoPassword="" />
      </div>

      <p className="relative mt-6 max-w-md text-center text-xs text-muted-foreground">
        Operational command center · {outlets} outlets across {areas} areas. Access is enforced by role &amp; outlet scope.
      </p>
    </div>
  );
}
