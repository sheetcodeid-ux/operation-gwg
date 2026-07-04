"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut } from "lucide-react";
import { DIVISION_ICON, type NavItem } from "@/lib/nav";
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

  // Divisions become collapsible groups, in first-seen order.
  const sections = useMemo(() => [...new Set(items.map((i) => i.section))], [items]);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const isOpen = (s: string) => !closed[s]; // expanded by default

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={cn(
        "no-print sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar/85 backdrop-blur-xl transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {sections.map((section, si) => {
          const sectionItems = items.filter((i) => i.section === section);

          // Collapsed rail: flatten to icons only.
          if (collapsed) {
            return (
              <div key={section} className="space-y-1">
                {si > 0 && <div className="mx-1 my-2 h-px bg-border/70" />}
                {sectionItems.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={`${section}:${item.href}`}
                      href={item.href}
                      title={t(`nav.${item.label}`)}
                      className={cn(
                        "flex h-10 items-center justify-center rounded-lg transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      {Icon && <Icon className="size-[18px]" />}
                    </Link>
                  );
                })}
              </div>
            );
          }

          const open = isOpen(section);
          const DivIcon = NAV_ICONS[DIVISION_ICON[section as keyof typeof DIVISION_ICON] ?? ""];

          return (
            <div key={section} className="space-y-0.5">
              <button
                type="button"
                onClick={() => setClosed((c) => ({ ...c, [section]: open }))}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                {DivIcon && <DivIcon className="size-[18px] shrink-0 text-muted-foreground" />}
                <span className="truncate">{section}</span>
                <ChevronRight
                  className={cn("ml-auto size-4 text-muted-foreground transition-transform duration-200", open && "rotate-90")}
                />
              </button>

              {open && (
                <div className="mt-0.5 space-y-0.5">
                  {sectionItems.map((item) => {
                    const Icon = NAV_ICONS[item.icon];
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={`${section}:${item.href}`}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg py-2 pl-9 pr-3 text-sm transition-colors",
                          active
                            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                        )}
                      >
                        {Icon && (
                          <Icon
                            className={cn(
                              "size-[18px] shrink-0 transition-colors",
                              active ? "text-foreground" : "text-muted-foreground",
                            )}
                          />
                        )}
                        <span className="truncate">{t(`nav.${item.label}`)}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
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
