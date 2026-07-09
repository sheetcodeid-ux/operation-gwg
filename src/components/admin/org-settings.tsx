"use client";

import * as React from "react";
import { Building2, LayoutGrid, Layers, Users } from "lucide-react";
import { StatTile } from "@/components/ui/stat";
import { cn } from "@/lib/utils";
import { DeptManager, type DeptDisplay } from "./dept-manager";
import { DivisionManager, type DivisionDisplay, type MenuOption } from "./division-manager";

type TabKey = "assessment" | "app";

/** Aniq-UI settings shell for the org structure: a unified KPI overview + pill
 *  tabs switching between the assessment org (departments/employees) and the
 *  app sidebar divisions. */
export function OrgSettings({
  departments,
  divisions,
  menuOptions,
}: {
  departments: DeptDisplay[];
  divisions: DivisionDisplay[];
  menuOptions: MenuOption[];
}) {
  const [tab, setTab] = React.useState<TabKey>("assessment");

  const totalEmp = departments.reduce((s, d) => s + d.employees.length, 0);
  const extraDept = departments.filter((d) => d.source === "extra").length;
  const extraEmp = departments.reduce((s, d) => s + d.employees.filter((e) => e.source === "extra").length, 0);
  const groupedMenus = divisions.reduce((s, d) => s + d.menus.length, 0);

  const tabs: { key: TabKey; label: string; icon: typeof Building2; count: number }[] = [
    { key: "assessment", label: "Struktur Assessment", icon: Users, count: departments.length },
    { key: "app", label: "Divisi Aplikasi", icon: LayoutGrid, count: divisions.length },
  ];

  return (
    <>
      {/* Unified KPI overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={Building2} label="Departemen" value={departments.length} sub={`${extraDept} tambahan · ${departments.length - extraDept} bawaan`} />
        <StatTile icon={Users} label="Karyawan" value={totalEmp} sub={`${extraEmp} ditambahkan admin`} />
        <StatTile icon={LayoutGrid} label="Divisi Aplikasi" value={divisions.length} sub="grup menu di sidebar" />
        <StatTile icon={Layers} label="Menu Ter-grup" value={groupedMenus} sub="di divisi kustom" />
      </div>

      {/* Pill tabs */}
      <div className="mt-5 overflow-x-auto">
        <div className="inline-flex min-w-full gap-1 rounded-xl border border-border bg-muted/50 p-1 sm:min-w-0">
          {tabs.map((t) => {
            const active = t.key === tab;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-pressed={active}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:flex-none",
                  active ? "bg-background text-foreground shadow-md ring-1 ring-border" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span>{t.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab body */}
      <div className="mt-4">
        {tab === "assessment" ? (
          <DeptManager departments={departments} />
        ) : (
          <DivisionManager divisions={divisions} menuOptions={menuOptions} />
        )}
      </div>
    </>
  );
}
