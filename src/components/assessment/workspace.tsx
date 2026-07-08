"use client";

import * as React from "react";
import { BookOpen, ClipboardList, GaugeCircle, Mic, ScrollText, Sparkles } from "lucide-react";
import { ASSESSMENT_ROLES, canSeeTab, type TabKey } from "@/lib/assessment/access";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { AssessmentProvider, useAssessment } from "./context";
import { PanduanTab } from "./panduan-tab";
import { SyaratTab } from "./syarat-tab";
import { PenilaianTab } from "./penilaian-tab";
import { InterviewTab } from "./interview-tab";
import { DashboardTab } from "./dashboard-tab";
import { ReferensiTab } from "./referensi-tab";

const TABS: { key: TabKey; label: string; short: string; icon: typeof BookOpen }[] = [
  { key: "panduan", label: "Panduan", short: "Panduan", icon: BookOpen },
  { key: "syarat", label: "Syarat & SA", short: "Syarat", icon: ClipboardList },
  { key: "penilaian", label: "Penilaian", short: "Nilai", icon: Sparkles },
  { key: "interview", label: "Interview", short: "Interview", icon: Mic },
  { key: "dashboard", label: "Dashboard", short: "Hasil", icon: GaugeCircle },
  { key: "referensi", label: "Referensi", short: "Ref", icon: ScrollText },
];

export function AssessmentWorkspace() {
  return (
    <AssessmentProvider>
      <WorkspaceInner />
    </AssessmentProvider>
  );
}

function WorkspaceInner() {
  const a = useAssessment();
  const tabs = TABS.filter((t) => canSeeTab(a.role, t.key));
  const roleDef = ASSESSMENT_ROLES.find((r) => r.value === a.role)!;
  // Content is rendered from the access-checked tab, never a raw drifted value.
  const activeTab: TabKey = canSeeTab(a.role, a.tab) ? a.tab : tabs[0].key;

  // On tab change (incl. "Selesai"/"Lanjut" navigation) jump back to the top so
  // the new page starts at its header, not wherever the previous one scrolled.
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab]);

  return (
    <>
      {/* Role viewpoint switcher (spec §3) — controls which tabs are accessible. */}
      <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">Akses sebagai</p>
          <p className="truncate text-[11px] text-muted-foreground">{roleDef.description}</p>
        </div>
        <Combobox
          portal
          value={a.role}
          onChange={(v) => a.setRole(v as typeof a.role)}
          options={ASSESSMENT_ROLES.map((r) => ({ value: r.value, label: r.label }))}
          className="w-full sm:w-72"
          searchPlaceholder="Cari peran…"
        />
      </div>

      {/* Tab strip — active tab is an elevated pill (Aniq-ui idiom). */}
      <div className="mb-4 overflow-x-auto">
        <div
          className="inline-flex min-w-full gap-1 rounded-xl border border-border bg-muted/50 p-1"
          style={{ minWidth: "100%" }}
        >
          {tabs.map((t) => {
            const active = t.key === activeTab;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => a.setTab(t.key)}
                aria-pressed={active}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-background text-foreground shadow-md ring-1 ring-border" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{t.label}</span>
                <span className="sm:hidden">{t.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* key remounts on tab change so the entrance animation replays */}
      <div key={activeTab} className="animate-fade-up">
        {activeTab === "panduan" && <PanduanTab />}
        {activeTab === "syarat" && <SyaratTab />}
        {activeTab === "penilaian" && <PenilaianTab />}
        {activeTab === "interview" && <InterviewTab />}
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "referensi" && <ReferensiTab />}
      </div>
    </>
  );
}
