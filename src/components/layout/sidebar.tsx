"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Lock, LogOut } from "lucide-react";
import { DIVISION_ICON, type Division, type MenuKey, type NavItem } from "@/lib/nav";
import { signOut } from "@/lib/actions/auth";
import { useI18n } from "@/lib/i18n/provider";
import { useSidebar } from "./sidebar-context";
import { useNavLock } from "./nav-lock";
import { NAV_ICONS } from "./icons";
import { cn } from "@/lib/utils";

/** Aniq-UI style sidebar: every division is shown as a collapsible group; the
 *  divisions the role cannot access render locked (blur + notice on click). */
export function Sidebar({
  items,
  allowedKeys,
  homeDivision,
  isAdmin,
  grants = [],
  department = "",
}: {
  items: NavItem[];
  allowedKeys: MenuKey[];
  homeDivision: string;
  isAdmin: boolean;
  grants?: string[];
  department?: string;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { collapsed } = useSidebar();
  const { showLocked } = useNavLock();
  const [pending, startTransition] = useTransition();

  const allowed = useMemo(() => new Set(allowedKeys), [allowedKeys]);
  const grantSet = useMemo(() => new Set(grants), [grants]);
  const sections = useMemo(() => [...new Set(items.map((i) => i.section))], [items]);
  // Only the most specific matching route is active, so a parent (e.g. /rnd/hpp)
  // isn't highlighted alongside its own sub-routes (/rnd/hpp/rekap, /rnd/hpp/bahan).
  const activeHref = useMemo(() => {
    let best = "";
    for (const it of items) {
      const h = it.href;
      if ((pathname === h || pathname.startsWith(h + "/")) && h.length > best.length) best = h;
    }
    return best;
  }, [items, pathname]);
  const isActive = (href: string) => href === activeHref;
  // Openable within the user's own division, their assigned department, or via
  // an explicit per-user grant.
  const canOpen = (i: NavItem) =>
    isAdmin || (i.section === homeDivision && allowed.has(i.key)) || i.section === department || grantSet.has(`${i.section}:${i.key}`);

  // Single-open accordion: the user's own division starts open; opening another
  // closes the previous one. null = all collapsed.
  const [openSection, setOpenSection] = useState<string | null>(homeDivision);
  const toggle = (s: string) => setOpenSection((cur) => (cur === s ? null : s));

  return (
    <aside
      className={cn(
        "no-print sticky top-16 hidden h-[calc(100dvh-4rem)] shrink-0 flex-col border-r border-sidebar-border bg-sidebar backdrop-blur-xl transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {collapsed ? (
          // Compact rail: only the accessible menus, as centered icons.
          <div className="space-y-1">
            {items
              .filter(canOpen)
              .map((item) => {
                const Icon = NAV_ICONS[item.icon];
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={t(`nav.${item.label}`)}
                    className={cn(
                      "flex h-10 items-center justify-center rounded-lg transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    {Icon && <Icon className="size-[18px]" />}
                  </Link>
                );
              })}
          </div>
        ) : (
          sections.map((section) => {
            const secItems = items.filter((i) => i.section === section);
            const secLocked = secItems.every((i) => !canOpen(i));
            const open = openSection === section;
            const DivIcon = NAV_ICONS[secItems[0]?.sectionIcon ?? DIVISION_ICON[section as Division]];
            return (
              <div key={section} className="mb-1">
                <button
                  type="button"
                  onClick={() => toggle(section)}
                  aria-expanded={open}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    secLocked ? "text-muted-foreground/70 hover:bg-muted/30" : "text-foreground hover:bg-muted/50",
                  )}
                >
                  {DivIcon && <DivIcon className="size-[18px] shrink-0" />}
                  <span className="flex-1 truncate text-left">{section}</span>
                  {secLocked && <Lock className="size-3.5 shrink-0 text-muted-foreground/60" />}
                  <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
                </button>

                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200",
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="relative ml-[1.55rem] mt-1 space-y-0.5 border-l border-border pl-3">
                      {secItems.map((item) => {
                        const Icon = NAV_ICONS[item.icon];
                        const locked = !canOpen(item);
                        const active = !locked && isActive(item.href);
                        const translated = t(`nav.${item.label}`);
                        // Fall back to the original label if no translation exists
                        // (t() returns the raw "nav.<label>" key when unmatched).
                        const label = translated.startsWith("nav.") ? item.label : translated;

                        if (locked) {
                          return (
                            <button
                              key={item.href}
                              type="button"
                              onClick={() => showLocked(section)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground/55 transition-colors hover:bg-muted/30 hover:text-muted-foreground"
                            >
                              {Icon && <Icon className="size-4 shrink-0" />}
                              <span className="flex-1 truncate">{label}</span>
                              <Lock className="size-3 shrink-0" />
                            </button>
                          );
                        }

                        // Work Tracker is shared across departments — carry the
                        // section so it opens pre-scoped to that department.
                        const linkHref = item.href === "/work-tracker" ? `/work-tracker?dept=${encodeURIComponent(section)}` : item.href;
                        return (
                          <Link
                            key={item.href}
                            href={linkHref}
                            className={cn(
                              "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                              active
                                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                            )}
                          >
                            {/* active indicator line, sitting on the group rail */}
                            {active && <span className="absolute -left-[13px] top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />}
                            {Icon && (
                              <Icon className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground/80")} />
                            )}
                            <span className="truncate">{label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
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
