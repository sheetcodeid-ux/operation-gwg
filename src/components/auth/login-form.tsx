"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, Lock, LogIn, Mail } from "lucide-react";
import { toast } from "sonner";
import { signInWithPassword } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DemoAccount {
  username: string;
  role: string;
  scope: string;
}

export function LoginForm({
  demoAccounts,
  demoPassword,
}: {
  demoAccounts: DemoAccount[];
  demoPassword: string;
}) {
  const [state, formAction, pending] = useActionState(signInWithPassword, null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div className="w-full space-y-5">
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Email Address</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="name@gwg.co"
              autoComplete="username"
              className="h-11 pl-10"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Password</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-11 px-10"
              required
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="remember" className="size-4 accent-primary" defaultChecked />
            Remember me
          </label>
          <button
            type="button"
            onClick={() => toast.info("Contact your administrator to reset your password.")}
            className="text-sm font-medium text-primary hover:underline"
          >
            Forgot your password?
          </button>
        </div>

        {state?.error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {state.error}
          </div>
        )}

        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <LogIn />} Sign In
        </Button>
      </form>

      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <button
          type="button"
          onClick={() => setShowDemo((v) => !v)}
          className="flex w-full items-center justify-between text-xs font-medium text-foreground/80"
        >
          <span>Demo accounts</span>
          <span className="text-muted-foreground">{showDemo ? "Hide" : "Show"}</span>
        </button>
        {showDemo && (
          <div className="mt-2 space-y-1">
            <p className="text-[11px] text-muted-foreground">
              Password for all: <code className="rounded bg-background px-1 py-0.5 text-foreground">{demoPassword}</code>
            </p>
            <div className="grid gap-1">
              {demoAccounts.map((a) => (
                <button
                  key={a.username}
                  type="button"
                  onClick={() => {
                    setUsername(a.username);
                    setPassword(demoPassword);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-left text-xs transition-colors hover:border-border hover:bg-background",
                  )}
                >
                  <span className="font-medium text-foreground">{a.role}</span>
                  <span className="truncate text-muted-foreground">{a.username}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
