"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Lock, LogOut } from "lucide-react";
import { DIVISION_ICON, navOpenPredicate, navSectionOpen, type Division, type MenuKey, type NavItem } from "@/lib/nav";
import { signOut } from "@/lib/actions/auth";
import { useI18n } from "@/lib/i18n/provider";
import { useSidebar } from "./sidebar-context";
import { useNavLock } from "./nav-lock";
import { NAV_ICONS } from "./icons";
import { navBlocks } from "./nav-blocks";
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
  const router = useRouter();
  const { t } = useI18n();
  const { collapsed } = useSidebar();
  const { showLocked } = useNavLock();
  const [pending, startTransition] = useTransition();

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
  // Aturannya dipusatkan di nav.ts — sidebar, menu ponsel, dan command palette
  // harus memakai syarat yang persis sama.
  const canOpen = useMemo(
    () => navOpenPredicate({ homeDivision, allowedKeys, department, grants, isAdmin }),
    [homeDivision, allowedKeys, department, grants, isAdmin],
  );

  // Single-open accordion: the user's own division starts open; opening another
  // closes the previous one. null = all collapsed.
  const [openSection, setOpenSection] = useState<string | null>(homeDivision);
  const toggle = (s: string) => setOpenSection((cur) => (cur === s ? null : s));

  // Sub-groups behave exactly like the division accordion: one open at a time,
  // and clicking the open one closes it. `undefined` = untouched, so the group
  // holding the current page shows open; null = the user closed them all.
  const [openGroup, setOpenGroup] = useState<string | null | undefined>(undefined);

  const label = (item: NavItem) => {
    const translated = t(`nav.${item.label}`);
    // t() returns the raw "nav.<label>" key when there is no translation.
    return translated.startsWith("nav.") ? item.label : translated;
  };

  return (
    <aside
      className={cn(
        "no-print hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
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
            const secLocked = !navSectionOpen(secItems, canOpen);
            const open = openSection === section;
            const DivIcon = NAV_ICONS[secItems[0]?.sectionIcon ?? DIVISION_ICON[section as Division]];

            // Divisi yang terkunci mengunci seluruh isinya, termasuk menu
            // perusahaan-luas. Membiarkan "Pengajuan" tetap terang di dalam
            // divisi orang lain hanya membingungkan — menu itu sudah ada di
            // divisi orangnya sendiri.
            const itemOpen = (i: NavItem) => !secLocked && canOpen(i);

            const renderItem = (item: NavItem) => {
              const Icon = NAV_ICONS[item.icon];
              const locked = !itemOpen(item);
              const active = !locked && isActive(item.href);

              if (locked) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => showLocked(section)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground/55 transition-colors hover:bg-muted/30 hover:text-muted-foreground"
                  >
                    {Icon && <Icon className="size-4 shrink-0" />}
                    <span className="flex-1 truncate">{label(item)}</span>
                    <Lock className="size-3 shrink-0" />
                  </button>
                );
              }

              // Work Tracker is shared across departments — carry the section so
              // it opens pre-scoped to that department.
              const linkHref = item.href === "/work-tracker" ? `/work-tracker?dept=${encodeURIComponent(section)}` : item.href;
              return (
                <Link
                  key={item.href}
                  href={linkHref}
                  // Prefetch on intent (hover/focus/touch) instead of on render.
                  // Eager prefetch fired every link in a group the moment it
                  // expanded: 4+ concurrent RSC renders of dynamic routes, whose
                  // payloads then reconcile on the main thread — which is what
                  // made the NEXT sidebar click freeze. Hovering still precedes
                  // any real click, so navigation stays instant.
                  prefetch={false}
                  onMouseEnter={() => router.prefetch(linkHref)}
                  onFocus={() => router.prefetch(linkHref)}
                  onTouchStart={() => router.prefetch(linkHref)}
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
                  <span className="truncate">{label(item)}</span>
                </Link>
              );
            };

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
                      {navBlocks(secItems).map((block) => {
                        if (block.kind === "item") return renderItem(block.item);

                        const groupId = `${section}/${block.name}`;
                        const hasActive = block.items.some((i) => itemOpen(i) && isActive(i.href));
                        const groupOpen = openGroup === undefined ? hasActive : openGroup === groupId;
                        const GroupIcon = block.icon ? NAV_ICONS[block.icon] : undefined;
                        // Judul sub-grup ikut meredup bila seluruh isinya
                        // terkunci — kalau tidak, "Talent Acquisition" tampil
                        // seterang menu yang benar-benar bisa dibuka.
                        const groupLocked = block.items.every((i) => !itemOpen(i));
                        return (
                          <div key={groupId} className="pt-0.5">
                            <button
                              type="button"
                              onClick={() => setOpenGroup(groupOpen ? null : groupId)}
                              aria-expanded={groupOpen}
                              // gap-2.5 + px-2.5 + size-4 icon = the exact same
                              // label offset as the menu links below it, so the
                              // group title and its children line up vertically.
                              className={cn(
                                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors hover:bg-muted/50",
                                groupLocked ? "text-muted-foreground/55" : "text-foreground/85",
                              )}
                            >
                              {GroupIcon && <GroupIcon className={cn("size-4 shrink-0", groupLocked ? "text-muted-foreground/55" : "text-muted-foreground")} />}
                              <span className="min-w-0 flex-1 truncate">{block.name}</span>
                              {groupLocked && <Lock className="size-3 shrink-0 text-muted-foreground/55" />}
                              <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-200", groupOpen && "rotate-180")} />
                            </button>
                            <div className={cn("grid transition-[grid-template-rows] duration-200", groupOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                              <div className="overflow-hidden">
                                {/* pl-3 (12px) + 1px border = the -left-[13px] the
                                    active indicator uses, so the dark bar sits
                                    exactly on the hairline rail. */}
                                <div className="ml-[0.55rem] mt-0.5 space-y-0.5 border-l border-border/70 pl-3">
                                  {block.items.map(renderItem)}
                                </div>
                              </div>
                            </div>
                          </div>
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
