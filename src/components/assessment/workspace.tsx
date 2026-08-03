"use client";

import * as React from "react";
import { BookOpen, ClipboardList, GaugeCircle, Mic, ScrollText, Settings2, Sparkles } from "lucide-react";
import { ASSESSMENT_ROLES, canSeeTab, type AssessmentRole, type TabKey } from "@/lib/assessment/access";
import type { EvaluatorIdentity } from "@/lib/assessment/session";
import { setOrgExtras, type OrgExtra } from "@/lib/assessment/org";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { AssessmentProvider, useAssessment } from "./context";
import { PanduanTab } from "./panduan-tab";
import { SyaratTab } from "./syarat-tab";
import { PenilaianTab } from "./penilaian-tab";
import { PeerPenilaianTab } from "./peer-penilaian-tab";
import { InterviewTab } from "./interview-tab";
import { DashboardTab } from "./dashboard-tab";
import { ReferensiTab } from "./referensi-tab";
import { SettingsPanel } from "./settings-panel";

const TABS: { key: TabKey; label: string; short: string; icon: typeof BookOpen }[] = [
  { key: "panduan", label: "Panduan", short: "Panduan", icon: BookOpen },
  { key: "syarat", label: "Syarat & SA", short: "Syarat", icon: ClipboardList },
  { key: "penilaian", label: "Penilaian", short: "Nilai", icon: Sparkles },
  { key: "interview", label: "Interview", short: "Interview", icon: Mic },
  { key: "dashboard", label: "Dashboard", short: "Hasil", icon: GaugeCircle },
  { key: "referensi", label: "Referensi", short: "Ref", icon: ScrollText },
];

export function AssessmentWorkspace({
  initialRole,
  scopeDepartmentId,
  evaluator,
  evaluators,
  peerCount = 0,
  isAdmin,
  canManage = false,
  isParticipant = false,
  viewer,
  viewerName,
  showSample,
  orgExtra,
}: {
  /** Viewpoint resolved server-side from the roster (never a silent fallback). */
  initialRole: AssessmentRole;
  scopeDepartmentId?: string;
  evaluator: EvaluatorIdentity | null;
  /** Every evaluator hat this account wears (dual-role HC/Head → 2). */
  evaluators?: EvaluatorIdentity[];
  /** How many participants this account reviews as a Rekan Sejawat. */
  peerCount?: number;
  isAdmin: boolean;
  /** Admin-only: shows the Pengaturan entry in the tab row. */
  canManage?: boolean;
  /** This account is also a participant (dinilai) → gets the Syarat & SA tab too. */
  isParticipant?: boolean;
  /** The signed-in viewer's identity (for their own Self Assessment). */
  viewer: { userId: string; name: string; department: string | null; jabatan: string | null };
  viewerName: string;
  showSample: boolean;
  orgExtra?: OrgExtra;
}) {
  // Merge admin-managed departments/employees into the org before the pickers
  // read it. Called synchronously in the render body (not useMemo, whose result
  // is discardable) so the module-level org state is refreshed *before* any child
  // picker reads departmentOptions(). Empty extras ⇒ identical to the built-in.
  setOrgExtras(orgExtra ?? { departments: [], employees: [] });
  // scopeDepartmentId narrows a Head/peer to their assigned candidates — wired
  // into the candidate picker & submit checks in the peer-scoring increment.
  void scopeDepartmentId;
  return (
    <AssessmentProvider initialRole={initialRole} canSwitchRole={isAdmin} evaluator={evaluator} evaluators={evaluators} peerCount={peerCount} showSample={showSample} viewer={viewer}>
      <WorkspaceInner viewerName={viewerName} canManage={canManage} isParticipant={isParticipant} />
    </AssessmentProvider>
  );
}

function WorkspaceInner({ viewerName, canManage, isParticipant }: { viewerName: string; canManage: boolean; isParticipant: boolean }) {
  const a = useAssessment();
  // Pengaturan is an in-workspace panel (instant), not a route — no navigation lag.
  const [showSettings, setShowSettings] = React.useState(false);
  // A participant who is ALSO an evaluator (e.g. Rekan Sejawat) keeps the Syarat
  // & Self-Assessment tab on top of their evaluator tabs → the 4-tab case.
  const canSee = (t: TabKey) => canSeeTab(a.role, t) || (isParticipant && t === "syarat");
  const tabs = TABS.filter((t) => canSee(t.key));
  const roleDef = ASSESSMENT_ROLES.find((r) => r.value === a.role)!;
  // Content is rendered from the access-checked tab, never a raw drifted value.
  const activeTab: TabKey = canSee(a.tab) ? a.tab : tabs[0].key;

  // Every tab change lands at the top of the new page. Button-driven steps
  // (Simpan & Lanjut / Selesai) glide up smoothly (paired with the fade-up);
  // manual tab clicks jump instantly with no entrance animation. Re-issue after
  // layout so a tall tab (Dashboard) can't keep the old scroll via scroll-anchoring.
  React.useEffect(() => {
    const behavior: ScrollBehavior = a.entrance ? "smooth" : "auto";
    window.scrollTo({ top: 0, behavior });
    const id = requestAnimationFrame(() => window.scrollTo({ top: 0, behavior }));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <>
      {/* Admin keeps the viewpoint switcher (spec §3). Registered evaluators get a
          fixed identity banner — their role follows the login, no manual switch. */}
      {a.canSwitchRole ? (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">Akses sebagai <span className="text-muted-foreground">(admin — pratinjau)</span></p>
            <p className="truncate text-[11px] text-muted-foreground">{roleDef.description}</p>
          </div>
          <Combobox
            portal
            matchTriggerWidth
            searchable={false}
            value={a.role}
            onChange={(v) => a.setRole(v as typeof a.role)}
            options={ASSESSMENT_ROLES.filter((r) => r.value !== "none").map((r) => ({ value: r.value, label: r.label }))}
            className="w-full sm:w-72"
          />
        </div>
      ) : (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-border bg-muted/20 p-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">Login sebagai <span className="font-semibold">{viewerName}</span></p>
            <p className="truncate text-[11px] text-muted-foreground">{roleDef.label} · {roleDef.description}</p>
          </div>
          <span className="shrink-0 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-500/25 dark:text-brand-400">
            {roleDef.label}
          </span>
        </div>
      )}

      {/* Tab strip — active tab is an elevated pill (Aniq-ui idiom). */}
      <div className="mb-4 overflow-x-auto">
        <div
          className="inline-flex min-w-full gap-1 rounded-xl border border-border bg-muted/50 p-1"
          style={{ minWidth: "100%" }}
        >
          {tabs.map((t) => {
            const active = t.key === activeTab && !showSettings;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => { setShowSettings(false); a.setTab(t.key); }}
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
          {/* Admin-only: Pengaturan sits at the far end — instant in-workspace panel. */}
          {canManage && (
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              aria-pressed={showSettings}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border-l border-border pl-3 pr-3 py-1.5 text-sm font-medium transition-colors",
                showSettings ? "bg-background text-foreground shadow-md ring-1 ring-border" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Settings2 className="size-4" />
              <span>Pengaturan</span>
            </button>
          )}
        </div>
      </div>

      {/* Entrance animation only for button-driven navigation, not manual clicks. */}
      {showSettings ? (
        <SettingsPanel />
      ) : (
      <div key={activeTab} className={a.entrance ? "animate-fade-up" : undefined}>
        {activeTab === "panduan" && <PanduanTab />}
        {activeTab === "syarat" && <SyaratTab />}
        {activeTab === "penilaian" && (a.role === "peer" ? <PeerPenilaianTab /> : <PenilaianTab />)}
        {activeTab === "interview" && <InterviewTab />}
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "referensi" && <ReferensiTab />}
      </div>
      )}
    </>
  );
}
