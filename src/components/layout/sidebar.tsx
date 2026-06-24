"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { NAV_SECTIONS, type NavItem } from "@/lib/nav";
import { NAV_ICONS } from "./icons";
import { cn } from "@/lib/utils";

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/85 backdrop-blur-xl lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-border px-5">
        <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 shadow-glow-brand">
          <Sparkles className="size-5 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-foreground">Operation GWG</p>
          <p className="text-[11px] text-muted-foreground">Command Center</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {NAV_SECTIONS.map((section) => {
          const sectionItems = items.filter((i) => i.section === section);
          if (!sectionItems.length) return null;
          return (
            <div key={section}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section}
              </p>
              <ul className="space-y-0.5">
                {sectionItems.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-brand-400 to-cyan-400" />
                        )}
                        {Icon && (
                          <Icon
                            className={cn(
                              "size-4 shrink-0 transition-colors",
                              active ? "text-brand-300" : "text-muted-foreground group-hover:text-foreground/80",
                            )}
                          />
                        )}
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="rounded-xl bg-gradient-to-br from-brand-600/20 to-cyan-600/10 p-3 ring-1 ring-border">
          <p className="text-xs font-medium text-foreground">Real-time monitoring</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">50 outlets · 5 areas live</p>
        </div>
      </div>
    </aside>
  );
}
