"use client";

import { CheckCircle2 } from "lucide-react";
import { DIMENSIONS, IV_RECOMMENDATIONS, interviewScore } from "@/lib/assessment/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useAssessment } from "./context";
import { CascadingPicker } from "./cascading-picker";
import { Banner, Card, ScoreOptions, SectionLabel } from "./parts";

/** Tab ④: final interview — 4 weighted dimensions + narrative + recommendation. */
export function InterviewTab() {
  const a = useAssessment();
  const score = interviewScore(a.interview);

  return (
    <div className="space-y-4">
      <Banner tone="amber" icon="🎙">
        <strong>Interview Akhir</strong> dilakukan setelah semua penilaian selesai. Interviewer membaca Self Assessment
        karyawan lebih dulu. Durasi ideal 30–45 menit. Hasil interview memverifikasi & memperkuat bukti — bukan pengganti skor.
      </Banner>

      <SectionLabel>Pilih Karyawan yang Diinterview</SectionLabel>
      <Card>
        <CascadingPicker />
        {a.resolved.nama && (
          <p className="mt-3 text-xs text-muted-foreground">
            Interview: <span className="font-medium text-foreground">{a.resolved.nama}</span> · {a.resolved.jabatan} ·{" "}
            {a.resolved.departemen}
          </p>
        )}
      </Card>

      <Card className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Skor Interview (informasional)</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Agregat 4 dimensi · dipakai sebagai penguat keputusan</p>
        </div>
        <p className="shrink-0 text-2xl font-semibold tabular-nums text-foreground">{score.toFixed(1)}</p>
      </Card>

      <SectionLabel>Formulir Penilaian Interview — 4 Dimensi</SectionLabel>
      <div className="space-y-3">
        {DIMENSIONS.map((d) => (
          <Card key={d.key}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Dimensi {d.no} — {d.title}</p>
              <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Bobot {d.weight}% · Skala 1–4
              </span>
            </div>
            <div className="mb-2.5 rounded-lg border border-border bg-muted/20 p-2.5">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pertanyaan panduan interviewer</p>
              <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                {d.guide.map((q, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-muted-foreground/50">•</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
            <ScoreOptions options={d.options} value={a.interview[d.key]} onPick={(v) => a.pickDimension(d.key, v)} accent="amber" />
          </Card>
        ))}
      </div>

      <SectionLabel>Catatan & Rekomendasi Interviewer</SectionLabel>
      <Card>
        <p className="mb-1.5 text-xs font-medium text-foreground/80">Catatan interviewer</p>
        <Textarea
          rows={5}
          value={a.ivNote}
          onChange={(e) => a.setIvNote(e.target.value)}
          placeholder="Ringkasan performa karyawan dalam interview, temuan penting, area yang perlu dikembangkan, dan rekomendasi interviewer…"
        />
      </Card>

      <Card>
        <p className="mb-2.5 text-sm font-semibold text-foreground">Rekomendasi dari Sesi Interview</p>
        <div className="space-y-2">
          {IV_RECOMMENDATIONS.map((r) => {
            const active = a.ivRecommendation === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => a.setIvRecommendation(r.value)}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-xl border p-3 text-left transition-colors",
                  active ? "border-amber-500/60 bg-amber-500/10 ring-1 ring-amber-500/30" : "border-border bg-muted/20 hover:bg-muted/40",
                )}
              >
                <span className="text-sm font-medium text-foreground">{r.label}</span>
                <span className="text-xs leading-relaxed text-muted-foreground">{r.body}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <FinishGate />
    </div>
  );
}

function FinishGate() {
  const a = useAssessment();
  const dimsDone = DIMENSIONS.every((d) => !!a.interview[d.key]);
  const ready = dimsDone && !!a.ivRecommendation;
  if (ready) {
    return (
      <Button className="h-12 w-full text-base" onClick={a.finishInterview}>
        <CheckCircle2 className="size-5" /> Selesai — Lihat Hasil di Dashboard
      </Button>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
      Lengkapi 4 dimensi interview dan pilih rekomendasi untuk menyelesaikan interview.
    </div>
  );
}
