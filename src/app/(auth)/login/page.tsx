import { ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getAreas, getOutlets, getUsers, areaName } from "@/lib/data/store";
import { ROLE_LABEL } from "@/lib/constants";
import { DEMO_PASSWORD } from "@/lib/data/credentials";
import type { Role } from "@/lib/types";
import { LoginForm, type DemoAccount } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

const ROLE_ORDER: Role[] = [
  "super_admin",
  "director",
  "head_operation",
  "area_coordinator",
  "supervisor",
  "pic_outlet",
];

function buildDemoAccounts(): DemoAccount[] {
  const users = getUsers();
  return ROLE_ORDER.map((role) => {
    const u = users.find((x) => x.role === role)!;
    let scope = "All outlets";
    if (role === "area_coordinator" && u.areaId) scope = areaName(u.areaId);
    else if (role === "supervisor") scope = `${u.outletIds?.length ?? 0} outlet`;
    else if (role === "pic_outlet") scope = "1 outlet";
    return { username: u.email, role: ROLE_LABEL[role], scope };
  });
}

export default function LoginPage() {
  const accounts = buildDemoAccounts();
  const outlets = getOutlets().length;
  const areas = getAreas().length;

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel — always dark for command-center identity */}
      <aside className="relative hidden overflow-hidden bg-[#0a0a12] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <div className="absolute -left-20 top-10 size-72 rounded-full bg-brand-600/30 blur-[100px]" />
          <div className="absolute right-0 top-1/3 size-80 rounded-full bg-cyan-500/20 blur-[120px]" />
          <div className="absolute bottom-0 left-1/4 size-72 rounded-full bg-amber-500/10 blur-[120px]" />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 shadow-lg shadow-brand-600/40">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">Operation GWG</p>
            <p className="text-xs text-white/50">Executive Command Center</p>
          </div>
        </div>

        <div className="relative space-y-6">
          <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight text-white">
            Full visibility over <span className="text-gradient-brand">every outlet</span>, in real time.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/60">
            Monitor hospitality, hygiene, work, events and complaints across{" "}
            <span className="font-medium text-white/90">{outlets} outlets</span> in{" "}
            <span className="font-medium text-white/90">{areas} areas</span> — the single source of truth
            for operational performance.
          </p>
          <div className="flex flex-wrap gap-2">
            {["Hospitality", "Hygiene", "Work", "Events", "Complaints", "Reports"].map((t) => (
              <span key={t} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/70">
                {t}
              </span>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} GWG Operations.</p>
      </aside>

      {/* Sign-in panel */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-7">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500">
              <Sparkles className="size-4 text-white" />
            </div>
            <span className="font-semibold text-foreground">Operation GWG</span>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Sign in</h2>
            <p className="text-sm text-muted-foreground">Enter your credentials to access the command center.</p>
          </div>

          <LoginForm demoAccounts={accounts} demoPassword={DEMO_PASSWORD} />

          <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Passwords are provisioned by your administrator. Access is enforced by role &amp; outlet
              scope — a PIC sees one outlet, a coordinator their assigned outlets, executives everything.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
