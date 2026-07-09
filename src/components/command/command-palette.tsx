"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search, Store, X } from "lucide-react";
import { NAV_ICONS } from "@/components/layout/icons";
import { cn } from "@/lib/utils";

interface NavEntry {
  label: string;
  href: string;
  icon: string;
  section: string;
}
interface OutletEntry {
  id: string;
  name: string;
  code: string;
  areaName: string;
}
interface Item {
  key: string;
  label: string;
  sub: string;
  href: string;
  icon: string;
  group: string;
}

const NAV_DESC: Record<string, string> = {
  "/dashboard": "Real-time operational overview",
  "/work-tracker": "Operational tasks and progress",
  "/events": "Branch events and milestones",
  "/hospitality": "Service quality assessments",
  "/hygiene": "Cleanliness audits and scores",
  "/complaints": "Customer complaints and root-cause",
  "/outlets": "Outlet directory and 360° view",
  "/reports": "Outlet, coordinator and region reports",
  "/admin/users": "Manage users and access scope",
  "/admin/departments": "Departemen, divisi & struktur assessment",
  "/admin/audit": "Recent operational activity",
};

export function CommandPalette({ navItems, outlets }: { navItems: NavEntry[]; outlets: OutletEntry[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const allItems = React.useMemo<Item[]>(() => {
    const nav: Item[] = navItems.map((n) => ({
      key: `nav:${n.href}`,
      label: n.label,
      sub: NAV_DESC[n.href] ?? n.section,
      href: n.href,
      icon: n.icon,
      group: n.section,
    }));
    const out: Item[] = outlets.map((o) => ({
      key: `out:${o.id}`,
      label: o.name,
      sub: `${o.code} · ${o.areaName}`,
      href: `/outlets/${o.id}`,
      icon: "Store",
      group: "Outlet",
    }));
    return [...nav, ...out];
  }, [navItems, outlets]);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? allItems.filter((i) => i.label.toLowerCase().includes(q) || i.sub.toLowerCase().includes(q))
      : allItems;
    return filtered.slice(0, 24);
  }, [allItems, query]);

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("[data-command-trigger]")) {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 20);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function go(item: Item) {
    close();
    router.push(item.href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) go(results[active]);
    } else if (e.key === "Escape") {
      close();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
      <div className="surface-solid relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Search for anything..."
            className="h-14 flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={close}
            aria-label="Close"
            className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-12 text-center text-sm text-muted-foreground">No results for “{query}”.</p>
          ) : (
            results.map((item, i) => {
              const Icon = NAV_ICONS[item.icon] ?? Store;
              const isActive = active === i;
              return (
                <button
                  key={item.key}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                    isActive ? "bg-muted" : "hover:bg-muted/50",
                  )}
                >
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card">
                    <Icon className="size-[18px] text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {item.group}
                    </span>
                    {isActive && <CornerDownLeft className="size-4 text-muted-foreground" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd>
              to select
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>esc</Kbd>
              to close
            </span>
          </div>
          <span className="hidden sm:inline">Search by Operation GWG</span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid h-5 min-w-5 place-items-center rounded bg-muted px-1 text-[10px] font-medium text-foreground/80">
      {children}
    </kbd>
  );
}
