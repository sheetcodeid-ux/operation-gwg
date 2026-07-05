"use client";

import {
  EVALUATORS,
  IV_RECOMMENDATIONS,
  PARAMETERS,
  evaluatorFilled,
  evaluatorScore,
  fastTrackEligible,
  finalScore,
  gradeTier,
  interviewScore,
} from "@/lib/assessment/config";
import { cn } from "@/lib/utils";
import { useAssessment } from "./context";
import { Banner, Card, ScoreRing, SectionLabel, TierPill } from "./parts";

/** Tab ⑤: aggregated results, gap analysis, interview integration & decision. */
export function DashboardTab() {
  const a = useAssessment();
  const final = finalScore(a.scores);
  const tier = gradeTier(final);
  const ivScore = interviewScore(a.interview);
  const ivRek = IV_RECOMMENDATIONS.find((r) => r.value === a.ivRecommendation) ?? null;
  const fastTrack = fastTrackEligible(a.scores, a.financialImpact);
  const allFilled = EVALUATORS.every((e) => evaluatorFilled(a.scores[e.key]) === PARAMETERS.length);

  // Final decision: an interview "tidak_layak" overrides an otherwise-eligible score.
  const overridden = a.ivRecommendation === "tidak_layak" && final >= 85;
  const decisionLabel = overridden ? "Tidak Direkomendasikan (Override Interview)" : tier.label;
  const decisionTone = overridden ? "no" : tier.tone;

  // Gap analysis: spread between the highest and lowest evaluator scores.
  const evalScores = EVALUATORS.map((e) => evaluatorScore(a.scores[e.key]));
  const gap = allFilled ? Math.max(...evalScores) - Math.min(...evalScores) : 0;

  return (
    <div className="space-y-4">
      {!allFilled && (
        <Banner tone="amber" icon="⚠">
          Belum semua penilai mengisi lengkap. Skor final di bawah dihitung dari data yang sudah masuk dan akan berubah saat
          penilaian dilengkapi.
        </Banner>
      )}

      <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
        <Card className="flex flex-col items-center justify-center gap-3 text-center">
          <ScoreRing value={final} sub="Skor Final" />
          <TierPill tone={decisionTone}>{decisionLabel}</TierPill>
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          {EVALUATORS.map((e, i) => (
            <Card key={e.key}>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{e.name} · {e.weight}%</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{evalScores[i].toFixed(1)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Kontribusi ke final: <span className="tabular-nums">{(evalScores[i] * (e.weight / 100)).toFixed(1)}</span>
              </p>
            </Card>
          ))}
          <Card className="sm:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{a.candidate.nama || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {a.candidate.jabatan || "—"} · Golongan {a.candidate.golongan || "—"} → {a.candidate.golonganTujuan || "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Skor Interview</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{ivScore.toFixed(1)}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <SectionLabel>Rincian per Parameter (rata-rata tertimbang penilai)</SectionLabel>
      <Card className="p-0">
        <div className="divide-y divide-border">
          {PARAMETERS.map((p) => {
            // Weighted average of this parameter across evaluators (by evaluator weight).
            let sum = 0;
            let wsum = 0;
            for (const e of EVALUATORS) {
              const v = a.scores[e.key][p.key];
              if (v) {
                sum += (v / p.scale) * 100 * (e.weight / 100);
                wsum += e.weight / 100;
              }
            }
            const pct = wsum ? sum / wsum : 0;
            return (
              <div key={p.key} className="flex items-center gap-3 px-4 py-3">
                <span className="w-40 shrink-0 truncate text-sm text-foreground">{p.title}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", pct >= 85 ? "bg-brand-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500")}
                    style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{pct.toFixed(0)}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-sm font-semibold text-foreground">Analisis Gap Antar Penilai</p>
          {allFilled ? (
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Selisih skor tertinggi–terendah: <span className="font-semibold tabular-nums text-foreground">{gap.toFixed(1)} poin</span>.{" "}
              {gap > 15
                ? "Gap cukup besar — disarankan sesi kalibrasi untuk menyamakan persepsi antar penilai."
                : "Gap dalam batas wajar — persepsi penilai relatif selaras."}
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">Menunggu seluruh penilai mengisi lengkap.</p>
          )}
        </Card>

        <Card className={cn(fastTrack && "ring-1 ring-violet-500/30")}>
          <p className="text-sm font-semibold text-foreground">Fast Track (Opsional)</p>
          <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={a.financialImpact}
              onChange={(e) => a.setFinancialImpact(e.target.checked)}
              className="mt-0.5 size-4 accent-violet-500"
            />
            <span>Terdapat bukti dampak finansial terukur (efisiensi / revenue / penghematan).</span>
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            {fastTrack ? (
              <span className="font-semibold text-violet-600 dark:text-violet-400">✓ Memenuhi syarat fast track — diskusikan promosi jabatan dengan manajemen senior.</span>
            ) : (
              "Butuh skor > 95, dampak finansial terukur, dan Attitude nilai 3 dari ≥ 2 penilai."
            )}
          </p>
        </Card>
      </div>

      <SectionLabel>Keputusan & Tindak Lanjut</SectionLabel>
      <Card className={cn("border", decisionTone === "no" && "border-red-500/30", decisionTone === "ok" && "border-brand-500/30")}>
        <div className="flex items-center gap-2">
          <TierPill tone={decisionTone}>{decisionLabel}</TierPill>
          <span className="text-sm font-semibold tabular-nums text-foreground">Skor {final.toFixed(1)}</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {overridden
            ? "Meskipun skor penilaian memenuhi syarat, sesi interview mengungkap concern serius sehingga kenaikan golongan tidak direkomendasikan pada periode ini."
            : tier.action}
        </p>
        {ivRek && (
          <p className="mt-2 text-xs text-muted-foreground">
            Rekomendasi interview: <span className="font-medium text-foreground">{ivRek.label}</span>
          </p>
        )}
      </Card>
    </div>
  );
}
