"use client";

import * as React from "react";
import {
  EVALUATORS,
  PARAMETERS,
  evaluatorFilled,
  evaluatorScore,
  paramContribution,
  type EvaluatorKey,
} from "@/lib/assessment/config";
import { cn } from "@/lib/utils";
import { useAssessment } from "./context";
import { Banner, Card, ScoreOptions, SectionLabel } from "./parts";

const ACCENT: Record<EvaluatorKey, "sky" | "emerald" | "violet"> = { al: "sky", hc: "emerald", dir: "violet" };
const TAB_ACTIVE: Record<EvaluatorKey, string> = {
  al: "border-sky-500/60 bg-sky-500/10",
  hc: "border-brand-500/60 bg-brand-500/10",
  dir: "border-violet-500/60 bg-violet-500/10",
};

/** Tab ③: fill scores for each of the 3 official evaluators. */
export function PenilaianTab() {
  const a = useAssessment();
  const [active, setActive] = React.useState<EvaluatorKey>("al");
  const evaluator = EVALUATORS.find((e) => e.key === active)!;
  const scores = a.scores[active];
  const score = evaluatorScore(scores);
  const filled = evaluatorFilled(scores);

  return (
    <div className="space-y-4">
      <Banner tone="info" icon="⚙">
        Isi penilaian dari 3 penilai resmi. Setiap parameter menampilkan kontribusi skor secara langsung agar transparan.
        Skor penilai dihitung otomatis di kartu ringkasan.
      </Banner>

      <SectionLabel>Pilih Penilai Resmi</SectionLabel>
      <div className="grid gap-2 sm:grid-cols-3">
        {EVALUATORS.map((e) => {
          const isActive = e.key === active;
          const eFilled = evaluatorFilled(a.scores[e.key]);
          return (
            <button
              key={e.key}
              type="button"
              onClick={() => setActive(e.key)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                isActive ? TAB_ACTIVE[e.key] : "border-border bg-muted/20 hover:bg-muted/40",
              )}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Penilai {e.no} · Bobot {e.weight}%</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">{e.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {eFilled === PARAMETERS.length ? (
                  <span className="text-brand-600 dark:text-brand-400">✓ Lengkap · {evaluatorScore(a.scores[e.key]).toFixed(1)}</span>
                ) : (
                  `${eFilled}/${PARAMETERS.length} parameter terisi`
                )}
              </p>
            </button>
          );
        })}
      </div>

      <Card className={cn("flex items-center justify-between gap-4", TAB_ACTIVE[active], "border")}>
        <div>
          <p className="text-sm font-semibold text-foreground">{evaluator.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{evaluator.note}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-2xl font-semibold tabular-nums text-foreground">{score.toFixed(1)}</p>
          <p className="text-[11px] text-muted-foreground">{filled}/{PARAMETERS.length} terisi</p>
        </div>
      </Card>

      <div className="space-y-3">
        {PARAMETERS.map((p) => {
          const value = scores[p.key];
          return (
            <Card key={p.key}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{p.title}</p>
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Bobot {p.weight}% · Skala 1–{p.scale}
                </span>
              </div>
              <p className="mb-2.5 text-xs leading-relaxed text-muted-foreground">Sumber: {p.source}</p>
              <ScoreOptions options={p.options} value={value} onPick={(v) => a.pickScore(active, p.key, v)} accent={ACCENT[active]} />
              {value ? (
                <p className="mt-2 text-right text-xs text-muted-foreground">
                  Kontribusi skor:{" "}
                  <span className="font-semibold text-foreground tabular-nums">{paramContribution(p.key, value)} poin</span>
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
