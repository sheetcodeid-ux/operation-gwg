"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut } from "lucide-react";
import type { NavItem } from "@/lib/nav";
import { signOut } from "@/lib/actions/auth";
import { useI18n } from "@/lib/i18n/provider";
import { useSidebar } from "./sidebar-context";
import { NAV_ICONS } from "./icons";
import { cn } from "@/lib/utils";

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { collapsed } = useSidebar();
  const [pending, startTransition] = useTransition();

  // Preserve order of first appearance → divisions become sidebar groups.
  const sections = useMemo(() => [...new Set(items.map((i) => i.section))], [items]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const isOpen = (s: string) => openSections[s] ?? true; // expanded by default

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={cn(
        "no-print sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar/85 backdrop-blur-xl transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {sections.map((section, si) => {
          const sectionItems = items.filter((i) => i.section === section);
          const open = isOpen(section);

          // Collapsed (icon rail): no headers, just icons with dividers.
          if (collapsed) {
            return (
              <div key={section} className="space-y-0.5">
                {si > 0 && <div className="mx-2 my-2 h-px bg-border" />}
                {sectionItems.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={t(`nav.${item.label}`)}
                      className={cn(
                        "group relative flex h-10 items-center justify-center rounded-lg text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      {Icon && <Icon className="size-[18px] shrink-0" />}
                    </Link>
                  );
                })}
              </div>
            );
          }

          return (
            <div key={section} className="space-y-0.5">
              <button
                type="button"
                onClick={() => setOpenSections((s) => ({ ...s, [section]: !open }))}
                className="flex w-full items-center justify-between rounded-md px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground/80"
              >
                <span>{section}</span>
                <ChevronRight className={cn("size-3.5 transition-transform duration-200", open && "rotate-90")} />
              </button>

              {open &&
                sectionItems.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-foreground" />
                      )}
                      {Icon && (
                        <Icon
                          className={cn(
                            "size-[18px] shrink-0 transition-colors",
                            active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/80",
                          )}
                        />
                      )}
                      <span className="truncate">{t(`nav.${item.label}`)}</span>
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => void signOut())}
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "flex w-full items-center rounded-lg text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50",
            collapsed ? "h-10 justify-center" : "gap-3 px-3 py-2",
          )}
        >
          <LogOut className="size-[18px] shrink-0" />
          {!collapsed && <span>{pending ? "Logging out…" : "Logout"}</span>}
        </button>
      </div>
    </aside>
  );
}
