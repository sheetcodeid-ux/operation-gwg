"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2, Circle, Loader2, Mic } from "lucide-react";
import { DIMENSIONS, IV_RECOMMENDATIONS, interviewScore, type IvRecValue } from "@/lib/assessment/config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useAssessment } from "./context";
import { CascadingPicker } from "./cascading-picker";
import { AssessmentQueue } from "./assessment-queue";
import { Banner, Card, ScoreOptions, SectionLabel } from "./parts";

const REC_ACTIVE: Record<IvRecValue, string> = {
  sangat_layak: "border-violet-500/60 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  layak: "border-brand-500/60 bg-brand-500/10 text-brand-700 dark:text-brand-400",
  tunda: "border-amber-500/60 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  tidak_layak: "border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-400",
};

/** Tab ④: final interview — 4 weighted dimensions + narrative + recommendation. */
export function InterviewTab() {
  const a = useAssessment();
  const score = interviewScore(a.interview);
  const myKey = a.evaluator?.evaluatorKey;
  const myRow = a.session?.evaluations.find((x) => x.evaluatorKey === myKey);
  const myLocked = !!myKey && !!myRow?.submitted && !!myRow?.ivVote;

  return (
    <div className={cn("space-y-4", myLocked && "[&_.iv-form]:pointer-events-none [&_.iv-form]:opacity-70")}>
      <Banner tone="amber" icon={<Mic className="size-4" />}>
        <strong>Interview Akhir</strong> dilakukan setelah semua penilaian selesai. Interviewer membaca Self Assessment
        karyawan lebih dulu. Durasi ideal 30–45 menit. Hasil interview memverifikasi & memperkuat bukti — bukan pengganti skor.
      </Banner>

      <AssessmentQueue verb="diinterview" />

      <SectionLabel>Atau Pilih Manual</SectionLabel>
      <Card>
        <CascadingPicker />
        {a.resolved.nama && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Interview: <span className="font-medium text-foreground">{a.resolved.nama}</span> · {a.resolved.jabatan} · {a.resolved.departemen}</span>
            <button type="button" onClick={a.resetCandidate} className="rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">Ganti / Kembali ke antrian</button>
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

      {myLocked && (
        <Banner tone="success" icon={<CheckCircle2 className="size-4" />}>
          Interview Anda sudah <strong>dikirim &amp; dikunci</strong> — tidak dapat diedit lagi.
        </Banner>
      )}

      <SectionLabel>Formulir Penilaian Interview — 4 Dimensi</SectionLabel>
      <div className="iv-form space-y-3">
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

      <SectionLabel>Rekomendasi Interview per Penilai</SectionLabel>
      <RecommendationSection />

      <FinishGate />
    </div>
  );
}

/** Vote block: a logged-in evaluator sets only their own recommendation and sees
 *  the others' live status; admin/preview keeps the full three-evaluator grid. */
function RecommendationSection() {
  const a = useAssessment();
  const mine = a.activeEvaluators.find((e) => e.key === a.evaluator?.evaluatorKey);

  if (a.evaluator && mine) {
    const others = a.activeEvaluators.filter((e) => e.key !== mine.key);
    return (
      <Card>
        <p className="text-sm font-semibold text-foreground">Rekomendasi Anda — {mine.name}</p>
        <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
          Bersifat kuantitatif, tidak mengubah skor. Pilih lalu simpan tanpa menunggu penilai lain.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {IV_RECOMMENDATIONS.map((r) => {
            const active = a.ivVotes[mine.key] === r.value;
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => a.setIvVote(mine.key, r.value)}
                title={r.body}
                className={cn(
                  "rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
                  active ? REC_ACTIVE[r.value] : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40",
                )}
              >
                {r.short}
              </button>
            );
          })}
        </div>
        {others.length > 0 && (
          <div className="mt-4 space-y-2 border-t border-border pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status penilai lain</p>
            {others.map((e) => {
              const row = a.session?.evaluations.find((x) => x.evaluatorKey === e.key);
              const voted = !!row?.ivVote;
              return (
                <div key={e.key} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {voted ? <CheckCircle2 className="size-3.5 text-brand-500" /> : <Circle className="size-3.5" />} {e.name}
                  </span>
                  <span className="text-muted-foreground">
                    {voted ? IV_RECOMMENDATIONS.find((r) => r.value === row!.ivVote)?.short : "Belum"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-sm font-semibold text-foreground">Rekomendasi tiap penilai resmi</p>
      <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
        Bersifat kuantitatif — tidak mengubah skor. Hasil akhir diambil dari <strong>rekomendasi terbanyak</strong>; bila ketiganya
        berbeda, diambil pilihan tengah (median).
      </p>
      <div className="space-y-3">
        {a.activeEvaluators.map((e) => (
          <div key={e.key}>
            <p className="mb-1.5 text-xs font-medium text-foreground/80">{e.name}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {IV_RECOMMENDATIONS.map((r) => {
                const active = a.ivVotes[e.key] === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => a.setIvVote(e.key, r.value)}
                    title={r.body}
                    className={cn(
                      "rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
                      active ? REC_ACTIVE[r.value] : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {r.short}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-sm text-muted-foreground">Rekomendasi akhir (terbanyak):</p>
        {a.ivRecommendation ? (
          <span className={cn("rounded-full border px-3 py-1 text-sm font-semibold", REC_ACTIVE[a.ivRecommendation])}>
            {IV_RECOMMENDATIONS.find((r) => r.value === a.ivRecommendation)?.short}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Belum semua penilai memberi rekomendasi</span>
        )}
      </div>
    </Card>
  );
}

function FinishGate() {
  const a = useAssessment();
  const dimsDone = DIMENSIONS.every((d) => !!a.interview[d.key]);

  if (a.evaluator) return <MyInterviewSave dimsDone={dimsDone} />;

  const allVoted = a.activeEvaluators.every((e) => !!a.ivVotes[e.key]);
  if (dimsDone && allVoted) {
    return (
      <Button className="h-12 w-full text-base" onClick={a.finishInterview}>
        <CheckCircle2 className="size-5" /> Selesai — Lihat Hasil di Dashboard
      </Button>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
      Lengkapi 4 dimensi interview dan rekomendasi dari semua penilai untuk menyelesaikan interview.
    </div>
  );
}

/** Per-evaluator interview save — submits the caller's dimensions + vote independently. */
function MyInterviewSave({ dimsDone }: { dimsDone: boolean }) {
  const a = useAssessment();
  const [msg, setMsg] = React.useState<string | null>(null);
  const myKey = a.evaluator?.evaluatorKey;
  const myVote = myKey ? a.ivVotes[myKey] ?? null : null;
  const ready = dimsDone && !!myVote;
  const myRow = a.session?.evaluations.find((x) => x.evaluatorKey === myKey);
  const saved = !!myRow?.submitted && !!myRow?.ivVote;

  const onSave = async () => {
    setMsg(null);
    const res = await a.submitMine({ interview: a.interview, ivVote: myVote, submitted: true });
    setMsg(res.ok ? "Interview Anda tersimpan." : res.error ?? "Gagal menyimpan.");
  };

  // Submitted = final & locked (no edits, integrity).
  if (saved) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-brand-500/40 bg-brand-500/5 p-3 text-center text-sm font-medium text-brand-600 dark:text-brand-400">
          <CheckCircle2 className="mr-1.5 inline size-4" /> Interview Anda sudah dikirim &amp; dikunci — tidak dapat diedit.
        </div>
        <Button variant="outline" className="h-11 w-full" onClick={a.finishInterview}>
          Lihat Hasil di Dashboard <ArrowRight className="size-4" />
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Button className="h-12 w-full text-base" onClick={onSave} disabled={!ready || a.sessionBusy}>
        {a.sessionBusy ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
        Kirim &amp; Kunci Interview
      </Button>
      {!ready && <p className="text-center text-xs text-muted-foreground">Lengkapi 4 dimensi & pilih rekomendasi Anda dulu. Setelah dikirim tidak bisa diedit.</p>}
      {msg && <p className="text-center text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
