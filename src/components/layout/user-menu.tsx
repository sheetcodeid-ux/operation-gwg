"use client";

import { useTransition } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { ROLE_LABEL } from "@/lib/constants";
import type { Role } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function UserMenu({ name, email, role }: { name: string; email: string; role: Role }) {
  const [pending, startTransition] = useTransition();

  return (
    <Popover
      trigger={({ toggle, open }) => (
        <button
          onClick={toggle}
          className="flex items-center gap-2 rounded-lg border border-border bg-card p-1 pr-2 text-left transition-colors hover:bg-muted"
        >
          <Avatar name={name} size={28} className="rounded-md" />
          <span className="hidden max-w-28 truncate text-sm font-medium text-foreground sm:inline">
            {name.split(" ")[0]}
          </span>
          <ChevronDown
            className={cn("size-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
          />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
            <Avatar name={name} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{name}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
              <p className="truncate text-[11px] font-medium text-primary">{ROLE_LABEL[role]}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-border" />
          <Link
            href="/profile"
            onClick={close}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/90 hover:bg-muted"
          >
            <UserRound className="size-4 text-muted-foreground" /> Profile
          </Link>
          <div className="my-1 h-px bg-border" />
          <button
            disabled={pending}
            onClick={() => startTransition(() => void signOut())}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            <LogOut className="size-4" /> {pending ? "Signing out…" : "Sign out"}
          </button>
        </>
      )}
    </Popover>
  );
}
