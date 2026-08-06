"use client";

import * as React from "react";
import { ArrowRight, CheckCircle2, Circle, Loader2, Settings2, Star } from "lucide-react";
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
import { AssessmentQueue } from "./assessment-queue";
import { PeerPenilaianTab } from "./peer-penilaian-tab";
import { Banner, Card, ScoreOptions, ScrollRow, SectionLabel } from "./parts";

const ACCENT: Record<EvaluatorKey, "sky" | "emerald" | "violet" | "amber"> = { al: "sky", hc: "emerald", peer: "amber", dir: "violet" };
const TAB_ACTIVE: Record<EvaluatorKey, string> = {
  al: "border-sky-500/60 bg-sky-500/10",
  hc: "border-brand-500/60 bg-brand-500/10",
  peer: "border-amber-500/60 bg-amber-500/10",
  dir: "border-violet-500/60 bg-violet-500/10",
};

/** Tab ③: fill scores for each active evaluator (3 standard, or Director-only). */
export function PenilaianTab() {
  const a = useAssessment();
  // An official evaluator who is ALSO a Rekan Sejawat for other divisions gets a
  // mode switch — the two panels are separate scoring flows.
  // Peer duty is shown INLINE (not behind a toggle): an evaluator who is also a
  // Rekan Sejawat must see that queue without hunting for a hidden tab.
  const [peerActive, setPeerActive] = React.useState(false);
  const hasPeerDuty = a.peerCount > 0;

  const evaluators = a.activeEvaluators;
  const single = evaluators.length === 1;
  const myKey = a.myKey ?? undefined;
  const locked = a.evaluators.length > 0; // a logged-in evaluator edits only their own column(s)

  const [activeKey, setActiveKey] = React.useState<EvaluatorKey>(evaluators[0].key);
  const active: EvaluatorKey =
    locked && myKey && evaluators.some((e) => e.key === myKey)
      ? myKey
      : evaluators.some((e) => e.key === activeKey)
        ? activeKey
        : evaluators[0].key;
  const evaluator = evaluators.find((e) => e.key === active)!;

  const scores = a.scores[active] ?? {};
  const score = evaluatorScore(scores);
  const filled = evaluatorFilled(scores);

  // A logged-in evaluator whose column isn't required for this position.
  const notMyCandidate = locked && a.myKeysForCandidate.length === 0;
  // Penilaian yang sudah dikirim tetap BISA diubah — penilai boleh memperbaiki
  // skornya lalu mengirim ulang. Tidak ada lagi penguncian.
  const mySubmitted = locked && !!a.session?.evaluations.find((x) => x.evaluatorKey === active)?.submitted;

  return (
    <div className="space-y-4">
      {hasPeerDuty && (
        <div className="space-y-3">
          <SectionLabel>Antrian Rekan Sejawat ({a.peerCount})</SectionLabel>
          <PeerPenilaianTab onActiveChange={setPeerActive} />
        </div>
      )}

      {!peerActive && (
      <div className="space-y-4">
      {hasPeerDuty && <SectionLabel>Antrian Penilaian Resmi</SectionLabel>}
      <Banner tone="info" icon={<Settings2 className="size-4" />}>
        {locked ? (
          <>
            Anda menilai sebagai <strong>{evaluator.name}</strong>. Isi 6 parameter lalu tekan <strong>Simpan</strong> — Anda
            tidak perlu menunggu penilai lain. Progres penilai lain muncul otomatis.
          </>
        ) : (
          <>
            Isi penilaian dari penilai resmi. Setiap parameter menampilkan kontribusi skor secara langsung agar transparan.
            Skor penilai dihitung otomatis di kartu ringkasan.
          </>
        )}
      </Banner>

      {/* Queue of assigned participants (Atasan/HC/Director) — one click to start. */}
      {locked && <AssessmentQueue mode="penilaian" />}

      <SectionLabel>{locked ? "Atau Pilih Manual" : "Pilih Karyawan yang Dinilai"}</SectionLabel>
      <Card>
        <CascadingPicker />
        {a.resolved.nama && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Menilai: <span className="font-medium text-foreground">{a.resolved.nama}</span> · {a.resolved.jabatan} · {a.resolved.departemen}</span>
            <button type="button" onClick={a.resetCandidate} className="rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground">Ganti / Kembali ke antrian</button>
          </p>
        )}
      </Card>

      {notMyCandidate ? (
        <Banner tone="amber" icon={<Circle className="size-4" />}>
          {hasPeerDuty ? (
            <>
              Anda bukan penilai resmi <strong>{a.resolved.nama || "karyawan ini"}</strong> — dia di luar divisi Anda. Bila
              namanya ada di <strong>Antrian Rekan Sejawat</strong> di atas, nilai dari sana.
            </>
          ) : (
            <>
              Posisi <strong>{a.resolved.jabatan || "ini"}</strong> tidak dinilai oleh peran Anda. Pilih karyawan lain yang
              menjadi tanggung jawab penilaian Anda.
            </>
          )}
        </Banner>
      ) : single && !locked ? (
        <Banner tone="violet" icon={<Star className="size-4" />}>
          Jabatan <strong>{a.resolved.jabatan || "ini"}</strong> dinilai langsung oleh <strong>Director</strong> — hanya 1
          penilai resmi (bobot 100%).
        </Banner>
      ) : null}

      {/* Dual-role (e.g. HC yang merangkap Head): pick which of MY columns to fill. */}
      {locked && a.myKeysForCandidate.length > 1 && (
        <div>
          <SectionLabel>Anda Menilai 2 Kolom — Pilih yang Diisi</SectionLabel>
          <ScrollRow cols={a.myKeysForCandidate.length}>
            {a.myKeysForCandidate.map((k) => {
              const def = evaluators.find((e) => e.key === k);
              if (!def) return null;
              const done = !!a.session?.evaluations.find((x) => x.evaluatorKey === k)?.submitted;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => a.setMyKey(k)}
                  className={cn("rounded-xl border p-3 text-left transition-colors", k === active ? TAB_ACTIVE[k] : "border-border bg-muted/20 hover:bg-muted/40")}
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Penilai {def.no} · Bobot {def.weight}%</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">{def.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {done ? <span className="text-brand-600 dark:text-brand-400">Sudah dikirim</span> : `${evaluatorFilled(a.scores[k])}/${PARAMETERS.length} terisi`}
                  </p>
                </button>
              );
            })}
          </ScrollRow>
        </div>
      )}

      {locked && !notMyCandidate && <EvaluatorProgress activeKey={active} />}

      {mySubmitted && (
        <Banner tone="success" icon={<CheckCircle2 className="size-4" />}>
          Penilaian Anda sudah <strong>terkirim</strong>. Masih bisa diubah — perbaiki skornya lalu kirim ulang.
        </Banner>
      )}

      {!locked && (
        <>
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
                      <span className="text-brand-600 dark:text-brand-400">Lengkap · {evaluatorScore(a.scores[e.key]).toFixed(1)}</span>
                    ) : (
                      `${eFilled}/${PARAMETERS.length} parameter terisi`
                    )}
                  </p>
                </button>
              );
            })}
          </ScrollRow>
        </>
      )}

      {!notMyCandidate && (
        <>
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
        </>
      )}

      {locked ? (
        !notMyCandidate && <MySaveBar activeKey={active} />
      ) : a.penilaianComplete ? (
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
      )}
    </div>
  );
}

/** Live status of every official evaluator on this candidate (cross-device). */
function EvaluatorProgress({ activeKey }: { activeKey: EvaluatorKey }) {
  const a = useAssessment();
  return (
    <div>
      <SectionLabel>Status Penilai (real-time)</SectionLabel>
      <ScrollRow cols={a.activeEvaluators.length === 1 ? 1 : 3}>
        {a.activeEvaluators.map((e) => {
          const row = a.session?.evaluations.find((x) => x.evaluatorKey === e.key);
          const done = !!row?.submitted;
          const isMe = e.key === activeKey;
          return (
            <div
              key={e.key}
              className={cn(
                "rounded-xl border p-3",
                done ? "border-brand-500/40 bg-brand-500/5" : "border-border bg-muted/20",
                isMe && "ring-1 ring-brand-500/30",
              )}
            >
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {done ? <CheckCircle2 className="size-3.5 text-brand-500" /> : <Circle className="size-3.5" />}
                {e.name} {isMe && <span className="text-brand-600 dark:text-brand-400">· Anda</span>}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{done ? "Sudah menyimpan" : "Belum menilai"}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Bobot {e.weight}%</p>
            </div>
          );
        })}
      </ScrollRow>
    </div>
  );
}

/** Per-evaluator save — submits the caller's own column independently. */
function MySaveBar({ activeKey }: { activeKey: EvaluatorKey }) {
  const a = useAssessment();
  const [msg, setMsg] = React.useState<string | null>(null);
  const myScores = a.scores[activeKey];
  const complete = evaluatorFilled(myScores) === PARAMETERS.length;
  const myRow = a.session?.evaluations.find((x) => x.evaluatorKey === activeKey);
  const saved = !!myRow?.submitted;

  const onSave = async () => {
    setMsg(null);
    const res = await a.submitMine({
      evaluatorKey: activeKey,
      scores: myScores,
      note: a.evaluatorNotes[activeKey] ?? "",
      submitted: true,
    });
    setMsg(res.ok ? (saved ? "Penilaian Anda diperbarui." : "Penilaian Anda tersimpan.") : res.error ?? "Gagal menyimpan.");
  };

  // Sudah dikirim pun tetap bisa diperbarui — tombol kirim tidak pernah hilang.
  return (
    <div className="space-y-2">
      <Button className="h-12 w-full text-base" onClick={onSave} disabled={!complete || a.sessionBusy}>
        {a.sessionBusy ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />}
        {saved ? "Perbarui Penilaian" : "Kirim Penilaian"}
      </Button>
      {saved && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 flex-1" onClick={a.resetCandidate}>
            Nilai Berikutnya
          </Button>
          <Button variant="outline" className="h-11 flex-1" onClick={a.continueToInterview}>
            Ke Interview <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
      {!complete && <p className="text-center text-xs text-muted-foreground">Lengkapi 6 parameter dulu.</p>}
      {complete && saved && !msg && (
        <p className="text-center text-xs text-muted-foreground">Penilaian sudah terkirim dan masih bisa diubah kapan saja.</p>
      )}
      {msg && <p className="text-center text-xs text-muted-foreground">{msg}</p>}
    </div>
  );
}
