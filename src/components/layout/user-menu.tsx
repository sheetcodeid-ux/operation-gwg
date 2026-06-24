"use client";

import { useTransition } from "react";
import { ChevronsUpDown, LogOut, Settings, UserRound } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { ROLE_LABEL } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Popover } from "@/components/ui/popover";

export function UserMenu({ name, email, role }: { name: string; email: string; role: Role }) {
  const [pending, startTransition] = useTransition();

  return (
    <Popover
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          className="flex items-center gap-2 rounded-lg p-1 pr-2 text-left transition-colors hover:bg-muted/50"
        >
          <Avatar name={name} size={32} />
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-xs font-medium text-foreground">{name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{ROLE_LABEL[role]}</p>
          </div>
          <ChevronsUpDown className="hidden size-3.5 text-muted-foreground sm:block" />
        </button>
      )}
    >
      <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
        <Avatar name={name} size={36} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
      </div>
      <div className="my-1 h-px bg-muted" />
      <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/80 hover:bg-muted/50">
        <UserRound className="size-4 text-muted-foreground" /> Profile
      </button>
      <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/80 hover:bg-muted/50">
        <Settings className="size-4 text-muted-foreground" /> Preferences
      </button>
      <div className="my-1 h-px bg-muted" />
      <button
        disabled={pending}
        onClick={() => startTransition(() => void signOut())}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
      >
        <LogOut className="size-4" /> {pending ? "Signing out…" : "Sign out"}
      </button>
    </Popover>
  );
}
