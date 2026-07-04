"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { type NavItem } from "@/lib/nav";
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

  // Divisions become static section headers, in first-seen order.
  const sections = useMemo(() => [...new Set(items.map((i) => i.section))], [items]);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={cn(
        "no-print sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar backdrop-blur-xl transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {sections.map((section, si) => {
          const sectionItems = items.filter((i) => i.section === section);
          return (
            <div key={section} className={cn(si > 0 && (collapsed ? "mt-2" : "mt-6"))}>
              {collapsed ? (
                si > 0 && <div className="mx-1 mb-2 h-px bg-border/70" />
              ) : (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section}
                </p>
              )}

              <div className="space-y-1">
                {sectionItems.map((item) => {
                  const Icon = NAV_ICONS[item.icon];
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={`${section}:${item.href}`}
                      href={item.href}
                      title={collapsed ? t(`nav.${item.label}`) : undefined}
                      className={cn(
                        "group flex items-center rounded-lg text-sm transition-colors",
                        collapsed ? "h-10 justify-center" : "gap-3 px-3 py-2.5",
                        active
                          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      {Icon && (
                        <Icon
                          className={cn(
                            "size-[18px] shrink-0 transition-colors",
                            active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/80",
                          )}
                        />
                      )}
                      {!collapsed && <span className="truncate">{t(`nav.${item.label}`)}</span>}
                    </Link>
                  );
                })}
              </div>
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
            collapsed ? "h-10 justify-center" : "gap-3 px-3 py-2.5",
          )}
        >
          <LogOut className="size-[18px] shrink-0" />
          {!collapsed && <span>{pending ? "Logging out…" : "Logout"}</span>}
        </button>
      </div>
    </aside>
  );
}
