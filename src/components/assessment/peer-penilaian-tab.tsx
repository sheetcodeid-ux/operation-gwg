"use client";

import * as React from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, Circle, Clock, Loader2, Send, Star, Users } from "lucide-react";
import { PARAMETERS, evaluatorScore, type ParamKey, type ParamScores } from "@/lib/assessment/config";
import { getMyPeerTargets, submitMyPeerReview, type PeerTarget } from "@/lib/actions/assessment-peer";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Banner, Card, ScoreOptions, SectionLabel } from "./parts";

/** Penilaian tab for a Rekan Sejawat (Penilai 3): score only the participants
 *  the settings assigned to this reviewer. Each peer submits independently; the
 *  system averages the submitted reviews into the Penilai 3 (25%) column. */
export function PeerPenilaianTab() {
  const [targets, setTargets] = React.useState<PeerTarget[] | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [scores, setScores] = React.useState<ParamScores>({});
  const [note, setNote] = React.useState("");
  const [busy, startBusy] = React.useTransition();

  const load = React.useCallback(async () => {
    const t = await getMyPeerTargets();
    setTargets(t);
    return t;
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const active = targets?.find((t) => t.participantUserId === activeId) ?? null;

  function open(t: PeerTarget) {
    setActiveId(t.participantUserId);
    setScores({ ...t.scores });
    setNote(t.note ?? "");
  }

  const filled = PARAMETERS.filter((p) => !!scores[p.key]).length;
  const complete = filled === PARAMETERS.length;
  const score = evaluatorScore(scores);

  function save(submit: boolean) {
    if (!active) return;
    if (submit && !complete) {
      toast.error("Lengkapi keenam parameter dulu sebelum mengirim.");
      return;
    }
    startBusy(async () => {
      const res = await submitMyPeerReview({ participantUserId: active.participantUserId, scores, note, submitted: submit });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(submit ? "Penilaian rekan sejawat dikirim." : "Draft tersimpan.");
      await load();
      if (submit) setActiveId(null);
    });
  }

  if (targets === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Memuat daftar…
      </div>
    );
  }

  // ── Detail: score one participant ──
  if (active) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setActiveId(null)} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Kembali ke daftar
        </button>
        <Banner tone="amber" icon={<Star className="size-4" />}>
          Anda menilai sebagai <strong>Rekan Sejawat</strong> untuk <strong>{active.name}</strong>. Isi jujur berdasarkan interaksi kerja sehari-hari, tanpa berkoordinasi dengan rekan lain. Penilaian dirahasiakan &amp; dirata-rata dengan rekan sejawat lain.
        </Banner>

        <Card className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{active.name}</p>
            <p className="truncate text-xs text-muted-foreground">{[active.department, active.jabatan].filter(Boolean).join(" · ") || "—"}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-bold tabular-nums text-foreground">{score.toFixed(1)}</p>
            <p className="text-[11px] text-muted-foreground">{filled}/6 terisi</p>
          </div>
        </Card>

        <div className="space-y-3">
          {PARAMETERS.map((p) => (
            <Card key={p.key} className="p-0">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.source}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground ring-1 ring-border">Bobot {p.weight}%</span>
              </div>
              <div className="p-3 sm:p-4">
                <ScoreOptions options={p.options} value={scores[p.key]} onPick={(v) => setScores((s) => ({ ...s, [p.key]: v }))} accent="amber" />
              </div>
            </Card>
          ))}
        </div>

        <div>
          <SectionLabel>Catatan (opsional)</SectionLabel>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh konkret yang mendukung penilaian…" rows={3} />
        </div>

        {active.submitted && (
          <Banner tone="success" icon={<CheckCircle2 className="size-4" />}>Penilaian Anda sudah terkirim. Anda masih bisa memperbaruinya selama periode assessment terbuka.</Banner>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => save(true)} disabled={busy || !complete} className="flex-1">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {active.submitted ? "Perbarui & Kirim" : "Kirim Penilaian"}
          </Button>
          <Button variant="outline" onClick={() => save(false)} disabled={busy}>
            Simpan Draft
          </Button>
        </div>
        {!complete && <p className="text-center text-[11px] text-muted-foreground">Lengkapi keenam parameter untuk mengirim.</p>}
      </div>
    );
  }

  // ── List of assigned participants ──
  return (
    <div className="space-y-4">
      <Banner tone="info" icon={<Users className="size-4" />}>
        Anda ditugaskan menilai <strong>{targets.length}</strong> rekan sejawat. Pilih nama untuk mengisi 6 parameter. Penilaian Anda independen dan dirahasiakan.
      </Banner>
      {targets.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <Users className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Belum ada penugasan</p>
          <p className="max-w-sm text-xs text-muted-foreground">Anda belum ditetapkan sebagai rekan sejawat penilai siapa pun. Hubungi HC bila ini keliru.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {targets.map((t) => (
            <button
              key={t.participantUserId}
              type="button"
              onClick={() => open(t)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40"
            >
              <span className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full ring-1",
                t.submitted ? "bg-brand-500/12 text-brand-600 ring-brand-500/25 dark:text-brand-400" : t.filled > 0 ? "bg-amber-500/12 text-amber-600 ring-amber-500/25 dark:text-amber-400" : "bg-muted text-muted-foreground ring-border",
              )}>
                {t.submitted ? <CheckCircle2 className="size-4" /> : t.filled > 0 ? <Clock className="size-4" /> : <Circle className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">{[t.department, t.jabatan].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                {t.submitted ? "Terkirim" : t.filled > 0 ? `Draft ${t.filled}/6` : "Belum dinilai"}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
