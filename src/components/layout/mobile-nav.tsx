"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sparkles, X } from "lucide-react";
import { type NavItem } from "@/lib/nav";
import { NAV_ICONS } from "./icons";
import { cn } from "@/lib/utils";

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const sections = [...new Set(items.map((i) => i.section))];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="grid size-9 place-items-center rounded-lg text-foreground/80 hover:bg-muted/50 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="surface-solid absolute left-0 top-0 h-full w-72 overflow-y-auto p-4">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="grid size-8 place-items-center rounded-lg bg-primary">
                  <Sparkles className="size-4 text-primary-foreground" />
                </div>
                <span className="text-sm font-semibold text-foreground">Operation GWG</span>
              </div>
              <button onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-lg hover:bg-muted/50">
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>

            {sections.map((section) => {
              const sectionItems = items.filter((i) => i.section === section);
              if (!sectionItems.length) return null;
              return (
                <div key={section} className="mb-4">
                  <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {section}
                  </p>
                  {sectionItems.map((item) => {
                    const Icon = NAV_ICONS[item.icon];
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-2 py-2 text-sm",
                          active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {Icon && <Icon className="size-4" />}
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
