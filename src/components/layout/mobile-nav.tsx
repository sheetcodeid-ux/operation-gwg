"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Lock, Menu, X } from "lucide-react";
import { DIVISION_ICON, type Division, type MenuKey, type NavItem } from "@/lib/nav";
import { useI18n } from "@/lib/i18n/provider";
import { useNavLock } from "./nav-lock";
import { NAV_ICONS } from "./icons";
import { navBlocks } from "./nav-blocks";
import { BrandLogo } from "./brand-logo";
import { cn } from "@/lib/utils";

export function MobileNav({
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();
  const { showLocked } = useNavLock();
  const allowed = useMemo(() => new Set(allowedKeys), [allowedKeys]);
  const grantSet = useMemo(() => new Set(grants), [grants]);
  const canOpen = (i: NavItem) =>
    isAdmin || (i.section === homeDivision && allowed.has(i.key)) || i.section === department || grantSet.has(`${i.section}:${i.key}`);
  const sections = useMemo(() => [...new Set(items.map((i) => i.section))], [items]);
  // Single-open accordion: home division open by default; opening another closes
  // the previous one. null = all collapsed.
  const [openSection, setOpenSection] = useState<string | null>(homeDivision);
  const toggle = (s: string) => setOpenSection((cur) => (cur === s ? null : s));
  // Sub-groups start expanded; the one containing the active route stays open.
  const [closedGroups, setClosedGroups] = useState<Set<string>>(() => new Set());
  const toggleGroup = (id: string) =>
    setClosedGroups((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Most-specific match only — avoids a parent route lighting up with its children.
  const activeHref = useMemo(() => {
    let best = "";
    for (const it of items) {
      const h = it.href;
      if ((pathname === h || pathname.startsWith(h + "/")) && h.length > best.length) best = h;
    }
    return best;
  }, [items, pathname]);
  const isActive = (href: string) => href === activeHref;

  // The drawer is portalled to <body>: rendered here it would sit inside the
  // topbar's backdrop-blur, whose backdrop-filter traps position:fixed to the
  // 64px header — so the overlay only covered a top strip. Portalling escapes it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const drawer = (
    <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="surface-solid absolute left-0 top-0 h-full w-72 overflow-y-auto p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrandLogo />
                <span className="text-sm font-semibold text-foreground">Operational System</span>
              </div>
              <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg hover:bg-muted/50">
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>

            {sections.map((section) => {
              const secItems = items.filter((i) => i.section === section);
              if (!secItems.length) return null;
              const secLocked = secItems.every((i) => !canOpen(i));
              const isOpen = openSection === section;
              const DivIcon = NAV_ICONS[secItems[0]?.sectionIcon ?? DIVISION_ICON[section as Division]];

              const renderItem = (item: NavItem) => {
                const Icon = NAV_ICONS[item.icon];
                const locked = !canOpen(item);
                const active = !locked && isActive(item.href);
                const translated = t(`nav.${item.label}`);
                // Fall back to the original label when no translation exists.
                const label = translated.startsWith("nav.") ? item.label : translated;

                if (locked) {
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        showLocked(section);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground/55 hover:bg-muted/30"
                    >
                      {Icon && <Icon className="size-4 shrink-0" />}
                      <span className="flex-1 truncate">{label}</span>
                      <Lock className="size-3 shrink-0" />
                    </button>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    {active && <span className="absolute -left-[13px] top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />}
                    {Icon && <Icon className="size-4 shrink-0" />}
                    <span className="truncate">{label}</span>
                  </Link>
                );
              };

              return (
                <div key={section} className="mb-1">
                  <button
                    type="button"
                    onClick={() => toggle(section)}
                    aria-expanded={isOpen}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      secLocked ? "text-muted-foreground/70" : "text-foreground hover:bg-muted/50",
                    )}
                  >
                    {DivIcon && <DivIcon className="size-[18px] shrink-0" />}
                    <span className="flex-1 truncate text-left">{section}</span>
                    {secLocked && <Lock className="size-3.5 shrink-0 text-muted-foreground/60" />}
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
                  </button>

                  <div className={cn("grid transition-[grid-template-rows] duration-200", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                    <div className="overflow-hidden">
                      <div className="relative ml-[1.4rem] mt-1 space-y-0.5 border-l border-border pl-3">
                        {navBlocks(secItems).map((block) => {
                          if (block.kind === "item") return renderItem(block.item);

                          const groupId = `${section}/${block.name}`;
                          const hasActive = block.items.some((i) => canOpen(i) && isActive(i.href));
                          const groupOpen = hasActive || !closedGroups.has(groupId);
                          const GroupIcon = block.icon ? NAV_ICONS[block.icon] : undefined;
                          return (
                            <div key={groupId} className="pt-0.5">
                              <button
                                type="button"
                                onClick={() => toggleGroup(groupId)}
                                aria-expanded={groupOpen}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-foreground/85 hover:bg-muted/50"
                              >
                                {GroupIcon && <GroupIcon className="size-4 shrink-0 text-muted-foreground" />}
                                <span className="min-w-0 flex-1 truncate">{block.name}</span>
                                <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-200", groupOpen && "rotate-180")} />
                              </button>
                              <div className={cn("grid transition-[grid-template-rows] duration-200", groupOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                                <div className="overflow-hidden">
                                  <div className="ml-[0.55rem] mt-0.5 space-y-0.5 border-l border-border/70 pl-2.5">
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
            })}
          </div>
        </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="grid size-9 place-items-center rounded-lg text-foreground/80 hover:bg-muted/50 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>
      {mounted && open && createPortal(drawer, document.body)}
    </>
  );
}
