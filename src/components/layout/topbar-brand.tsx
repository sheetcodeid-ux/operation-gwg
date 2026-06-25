"use client";

import Link from "next/link";
import { Menu, Sparkles } from "lucide-react";
import { useSidebar } from "./sidebar-context";
import { cn } from "@/lib/utils";

/** Desktop topbar-left column — width follows the sidebar so the toggle aligns with the icon column. */
export function TopbarBrand() {
  const { collapsed, toggle } = useSidebar();
  return (
    <div
      className={cn(
        "hidden h-16 shrink-0 items-center border-r border-border transition-[width] duration-200 lg:flex",
        collapsed ? "w-16 justify-center" : "w-64 gap-2.5 px-4",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle sidebar"
        className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Menu className="size-[18px]" />
      </button>
      {!collapsed && (
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-lg bg-primary">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">Operation GWG</span>
        </Link>
      )}
    </div>
  );
}
