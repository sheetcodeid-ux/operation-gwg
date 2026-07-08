"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import {
  PARAMETERS,
  evaluatorFilled,
  evaluatorScore,
  paramContribution,
  type EvaluatorKey,
} from "@/lib/assessment/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useAssessment } from "./context";
import { CascadingPicker } from "./cascading-picker";
import { Banner, Card, ScoreOptions, ScrollRow, SectionLabel } from "./parts";

const ACCENT: Record<EvaluatorKey, "sky" | "emerald" | "violet"> = { al: "sky", hc: "emerald", dir: "violet" };
const TAB_ACTIVE: Record<EvaluatorKey, string> = {
  al: "border-sky-500/60 bg-sky-500/10",
  hc: "border-brand-500/60 bg-brand-500/10",
  dir: "border-violet-500/60 bg-violet-500/10",
};

/** Tab ③: fill scores for each active evaluator (3 standard, or Director-only). */
export function PenilaianTab() {
  const a = useAssessment();
  const evaluators = a.activeEvaluators;
  const single = evaluators.length === 1;

  const [activeKey, setActiveKey] = React.useState<EvaluatorKey>(evaluators[0].key);
  // Keep the selected evaluator valid when the active set changes (e.g. Head → Director-only).
  const active = evaluators.some((e) => e.key === activeKey) ? activeKey : evaluators[0].key;
  const evaluator = evaluators.find((e) => e.key === active)!;

  const scores = a.scores[active];
  const score = evaluatorScore(scores);
  const filled = evaluatorFilled(scores);

  return (
    <div className="space-y-4">
      <Banner tone="info" icon="⚙">
        Isi penilaian dari penilai resmi. Setiap parameter menampilkan kontribusi skor secara langsung agar transparan.
        Skor penilai dihitung otomatis di kartu ringkasan.
      </Banner>

      <SectionLabel>Pilih Karyawan yang Dinilai</SectionLabel>
      <Card>
        <CascadingPicker />
        {a.resolved.nama && (
          <p className="mt-3 text-xs text-muted-foreground">
            Menilai: <span className="font-medium text-foreground">{a.resolved.nama}</span> · {a.resolved.jabatan} ·{" "}
            {a.resolved.departemen}
          </p>
        )}
      </Card>

      {single ? (
        <Banner tone="violet" icon="★">
          Jabatan <strong>{a.resolved.jabatan || "ini"}</strong> dinilai langsung oleh <strong>Director</strong> — hanya 1
          penilai resmi (bobot 100%).
        </Banner>
      ) : null}

      <SectionLabel>{single ? "Penilai Resmi" : "Pilih Penilai Resmi"}</SectionLabel>
      <ScrollRow cols={single ? 1 : 3}>
        {evaluators.map((e) => {
          const isActive = e.key === active;
          const eFilled = evaluatorFilled(a.scores[e.key]);
          return (
            <button
              key={e.key}
              type="button"
              onClick={() => setActiveKey(e.key)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                isActive ? TAB_ACTIVE[e.key] : "border-border bg-muted/20 hover:bg-muted/40",
              )}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {single ? "Penilai Tunggal" : `Penilai ${e.no}`} · Bobot {e.weight}%
              </p>
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
      </ScrollRow>

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

      <Card>
        <p className="mb-1.5 text-sm font-semibold text-foreground">Catatan {evaluator.name}</p>
        <p className="mb-2 text-xs text-muted-foreground">Opsional — catatan kualitatif yang tampil di Dashboard sebagai bukti pendukung.</p>
        <Textarea
          rows={3}
          value={a.evaluatorNotes[active] ?? ""}
          onChange={(e) => a.setEvaluatorNote(active, e.target.value)}
          placeholder="Contoh: konsisten melampaui target, inisiatif tinggi, perlu penguatan pada presentasi ke manajemen…"
        />
      </Card>

      {a.penilaianComplete ? (
        <Button className="h-12 w-full text-base" onClick={a.continueToInterview}>
          Simpan &amp; Lanjut ke Interview
          <ArrowRight className="size-5" />
        </Button>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
          Lengkapi seluruh parameter {single ? "penilai Director" : "dari ketiga penilai"} untuk lanjut ke Interview.
        </div>
      )}
    </div>
  );
}
