import { BrandLogo } from "@/components/layout/brand-logo";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getAreas, getOutlets } from "@/lib/data/store";
import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Already signed in → straight to the dashboard. (This used to live in the
  // Node-runtime proxy, which Cloudflare Workers can't run; enforced here now.)
  if (await getSessionUser()) redirect("/dashboard");

  const t = await getT();
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
          <BrandLogo />
          <span className="text-sm font-semibold text-foreground">Operational System</span>
        </div>
        <ThemeToggle />
      </div>

      {/* card */}
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card/80 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandLogo className="mb-4 size-16 rounded-2xl shadow-sm" markClassName="size-11" />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Operation GWG</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        <LoginForm
          demoAccounts={[]}
          demoPassword=""
          labels={{
            email: t("login.email"),
            password: t("login.password"),
            signIn: t("login.signIn"),
            signingIn: t("login.signingIn"),
            remember: t("login.remember"),
            forgot: t("login.forgot"),
            forgotToast: t("login.forgotToast"),
          }}
        />
      </div>

      <p className="relative mt-6 max-w-md text-center text-xs text-muted-foreground">
        Operational command center · {outlets} outlets across {areas} areas. Access is enforced by role &amp; outlet scope.
      </p>
    </div>
  );
}
