"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Loader2, Lock, User } from "lucide-react";
import { signInWithPassword } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
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
  const [showDemo, setShowDemo] = useState(false);

  return (
    <div className="w-full max-w-sm space-y-6">
      <form action={formAction} className="space-y-4">
        <Field label="Username">
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="name@gwg.co"
              autoComplete="username"
              className="h-10 pl-9"
              required
            />
          </div>
        </Field>

        <Field label="Password">
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="h-10 pl-9"
              required
            />
          </div>
        </Field>

        {state?.error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {state.error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Sign in
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
