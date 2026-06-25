"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { NAV_SECTIONS, type NavItem } from "@/lib/nav";
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

  const sections = NAV_SECTIONS.filter((s) => items.some((i) => i.section === s));

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
          return (
            <div key={section} className="space-y-0.5">
              {collapsed ? (
                si > 0 && <div className="mx-2 my-2 h-px bg-border" />
              ) : (
                <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t(`section.${section}`)}
                </p>
              )}

              {sectionItems.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? t(`nav.${item.label}`) : undefined}
                    className={cn(
                      "group relative flex items-center rounded-lg text-sm transition-colors",
                      collapsed ? "h-10 justify-center" : "gap-3 px-3 py-2",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {active && !collapsed && (
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
                    {!collapsed && <span className="truncate">{t(`nav.${item.label}`)}</span>}
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
