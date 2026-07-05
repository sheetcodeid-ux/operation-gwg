"use client";

import * as React from "react";
import { BookOpen, ClipboardList, GaugeCircle, Mic, ScrollText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssessmentProvider } from "./context";
import { PanduanTab } from "./panduan-tab";
import { SyaratTab } from "./syarat-tab";
import { PenilaianTab } from "./penilaian-tab";
import { InterviewTab } from "./interview-tab";
import { DashboardTab } from "./dashboard-tab";
import { ReferensiTab } from "./referensi-tab";

type TabKey = "panduan" | "syarat" | "penilaian" | "interview" | "dashboard" | "referensi";

const TABS: { key: TabKey; label: string; short: string; icon: typeof BookOpen }[] = [
  { key: "panduan", label: "Panduan", short: "Panduan", icon: BookOpen },
  { key: "syarat", label: "Syarat & SA", short: "Syarat", icon: ClipboardList },
  { key: "penilaian", label: "Penilaian", short: "Nilai", icon: Sparkles },
  { key: "interview", label: "Interview", short: "Interview", icon: Mic },
  { key: "dashboard", label: "Dashboard", short: "Hasil", icon: GaugeCircle },
  { key: "referensi", label: "Referensi", short: "Ref", icon: ScrollText },
];

export function AssessmentWorkspace() {
  const [tab, setTab] = React.useState<TabKey>("panduan");

  return (
    <AssessmentProvider>
      {/* Horizontally scrollable tab strip — an elevated pill marks the active tab (Aniq-ui idiom). */}
      <div className="mb-4 overflow-x-auto">
        <div className="inline-flex min-w-full gap-1 rounded-xl border border-border bg-muted/50 p-1">
          {TABS.map((t) => {
            const active = t.key === tab;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
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

      {tab === "panduan" && <PanduanTab />}
      {tab === "syarat" && <SyaratTab />}
      {tab === "penilaian" && <PenilaianTab />}
      {tab === "interview" && <InterviewTab />}
      {tab === "dashboard" && <DashboardTab />}
      {tab === "referensi" && <ReferensiTab />}
    </AssessmentProvider>
  );
}
