"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEWS = [
  { v: "", label: "Dashboard 1 · Eksekutif" },
  { v: "ops2", label: "Dashboard 2 · Operasional" },
];

/** Dropdown to switch between the two Operation dashboards on the same page (?view=). */
export function DashboardSwitcher({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const active = VIEWS.find((x) => x.v === current) ?? VIEWS[0];

  function pick(v: string) {
    setOpen(false);
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set("view", v);
    else sp.delete("view");
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
      >
        <LayoutDashboard className="size-4 text-muted-foreground" />
        {active.label}
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-60 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg">
          {VIEWS.map((x) => (
            <button
              key={x.v}
              type="button"
              onClick={() => pick(x.v)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                x.v === current ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
