"use client";

import * as React from "react";
import { CheckCircle2, Circle, Clock, Loader2 } from "lucide-react";
import { getMyAssessmentTargets, type EvalTarget } from "@/lib/actions/assessment-eval";
import { cn } from "@/lib/utils";
import { useAssessment } from "./context";
import { SectionLabel } from "./parts";

/** Queue of the participants the signed-in evaluator must assess — pick a name
 *  to start scoring (reuses the session flow). Falls back to nothing (manual
 *  picker below) when the evaluator has no assigned participants. */
export function AssessmentQueue({ verb = "menilai" }: { verb?: string }) {
  const a = useAssessment();
  const [targets, setTargets] = React.useState<EvalTarget[] | null>(null);
  const selectedId = a.candidate.employeeId.startsWith("emp_usr_") ? a.candidate.employeeId.slice("emp_usr_".length) : "";

  React.useEffect(() => {
    let live = true;
    getMyAssessmentTargets().then((t) => { if (live) setTargets(t); });
    return () => { live = false; };
    // Re-fetch whenever the selection changes (pick / reset / after submit).
  }, [a.candidate.employeeId]);

  if (targets === null) {
    return <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memuat antrian…</div>;
  }
  if (targets.length === 0) return null;

  return (
    <div>
      <SectionLabel>Antrian ({targets.length}) — pilih siapa yang {verb}</SectionLabel>
      <div className="space-y-2">
        {targets.map((t) => {
          const active = selectedId === t.participantUserId;
          return (
            <button
              key={t.participantUserId}
              type="button"
              onClick={() => a.pickParticipant(t.participantUserId, t.department, t.jabatan)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                active ? "border-brand-500/50 bg-brand-500/5 ring-1 ring-brand-500/25" : "border-border bg-muted/20 hover:bg-muted/40",
              )}
            >
              <span className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full ring-1",
                t.mineSubmitted ? "bg-brand-500/12 text-brand-600 ring-brand-500/25 dark:text-brand-400" : t.mineFilled > 0 ? "bg-amber-500/12 text-amber-600 ring-amber-500/25 dark:text-amber-400" : "bg-muted text-muted-foreground ring-border",
              )}>
                {t.mineSubmitted ? <CheckCircle2 className="size-4" /> : t.mineFilled > 0 ? <Clock className="size-4" /> : <Circle className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                  {t.name}
                  {t.isHead && <span className="rounded bg-violet-500/12 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600 dark:text-violet-400">Head</span>}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{[t.department, t.jabatan].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                {t.mineSubmitted ? "Terkirim" : t.mineFilled > 0 ? `Draft ${t.mineFilled}/6` : "Belum"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
