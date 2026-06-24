"use client";

import * as React from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changeOwnPasswordAction } from "@/lib/actions/users";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function ChangePasswordForm() {
  const [pending, start] = React.useTransition();
  const [pwd, setPwd] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  function submit() {
    if (pwd.length < 6) return void toast.error("Password must be at least 6 characters.");
    if (pwd !== confirm) return void toast.error("Passwords don't match.");
    start(async () => {
      const res = await changeOwnPasswordAction(pwd);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Password updated");
      setPwd("");
      setConfirm("");
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="New Password">
          <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
        </Field>
        <Field label="Confirm Password">
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
        </Field>
      </div>
      <Button onClick={submit} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Update Password
      </Button>
    </div>
  );
}
