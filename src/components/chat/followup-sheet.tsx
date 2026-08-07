"use client";

import * as React from "react";
import { CheckCircle2, Clock, Loader2, RotateCcw, TriangleAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CameraCapture, type CapturedPhoto } from "@/components/ui/camera-capture";
import { Field, Textarea } from "@/components/ui/input";
import {
  hygieneFollowupAction,
  hygieneResolveFollowupAction,
  hygieneReviewFollowupAction,
} from "@/lib/actions/hygiene-followup";
import { uploadChatFiles } from "./upload";
import { cn } from "@/lib/utils";
import { FOLLOWUP_STATUS, type FollowupAttempt, type HygieneFollowup } from "@/lib/chat-shared";

/**
 * Temuan hygiene yang dibuka dari obrolan.
 *
 * Alurnya berputar sampai benar-benar beres:
 *   pelapor menemukan → supervisor memperbaiki + FOTO LANGSUNG → pelapor menilai
 *   → ACC (selesai) atau dikembalikan (temuan menggantung lagi).
 *
 * Bukti diambil dengan kamera, bukan dipilih dari galeri, dan waktunya dibakar
 * ke dalam gambar — foto lama dari galeri tidak membuktikan apa pun tentang
 * kondisi hari ini.
 */
export function FollowupSheet({
  followupId,
  meId,
  onClose,
  onResolved,
}: {
  followupId: string | null;
  meId: string;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [data, setData] = React.useState<HygieneFollowup | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [shots, setShots] = React.useState<CapturedPhoto[]>([]);
  const [reviewNote, setReviewNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async (id: string) => {
    setLoading(true);
    const d = await hygieneFollowupAction(id);
    setData(d);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (!followupId) return;
    setData(null);
    setNote("");
    setShots([]);
    setReviewNote("");
    void load(followupId);
  }, [followupId, load]);

  const isAssignee = data?.assignedTo === meId;
  const isRaiser = data?.raisedBy === meId;
  const status = data?.status ?? "menunggu";
  const meta = FOLLOWUP_STATUS[status];

  async function submitProof() {
    if (!data) return;
    if (shots.length === 0) return toast.error("Ambil dulu foto bukti perbaikannya.");
    setBusy(true);
    try {
      const proof = await uploadChatFiles(shots.map((s) => s.file));
      const res = await hygieneResolveFollowupAction({ id: data.id, resolution: note, proof });
      if (res.error) return toast.error(res.error);
      toast.success("Bukti terkirim — menunggu verifikasi");
      setShots([]);
      setNote("");
      await load(data.id);
      onResolved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim bukti.");
    } finally {
      setBusy(false);
    }
  }

  async function review(accept: boolean) {
    if (!data) return;
    if (!accept && !reviewNote.trim()) return toast.error("Tulis alasan pengembaliannya.");
    setBusy(true);
    const res = await hygieneReviewFollowupAction({ id: data.id, accept, note: reviewNote });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(accept ? "Perbaikan diterima" : "Dikembalikan untuk dibersihkan ulang");
    setReviewNote("");
    await load(data.id);
    onResolved();
  }

  return (
    <BottomSheet
      open={followupId !== null}
      onOpenChange={(v) => !v && onClose()}
      title="Temuan Hygiene"
      description={data ? `${data.area || "Area"} · ${data.outletName}` : undefined}
      className="sm:max-w-lg"
    >
      {loading && !data ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : !data ? (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">Temuan tidak ditemukan.</p>
      ) : (
        <div className="px-5 pb-6">
          <StatusBanner status={status} label={meta.label} tone={meta.tone} rounds={data.attempts.length} />

          {/* Kondisi awal */}
          <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Sebelum
          </p>
          {data.photoUrl && <Photo url={data.photoUrl} alt={data.area} tall />}
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{data.note}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {data.raisedByName} · {stamp(data.createdAt)} · untuk {data.assignedToName}
          </p>

          {/* Riwayat putaran perbaikan */}
          {data.attempts.map((a, i) => (
            <AttemptBlock key={i} a={a} index={i} total={data.attempts.length} />
          ))}

          {/* Supervisor: kirim bukti */}
          {status === "menunggu" && isAssignee && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-1 text-sm font-semibold text-foreground">
                {data.attempts.length > 0 ? "Kirim bukti perbaikan ulang" : "Kirim bukti perbaikan"}
              </p>
              <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
                Foto diambil langsung dari kamera dan waktunya dibakar ke gambar. Foto lama dari galeri tidak
                membuktikan kondisi hari ini.
              </p>

              <CameraCapture
                label="Foto sesudah perbaikan"
                items={shots}
                onChange={setShots}
                min={1}
                max={6}
                stampPrefix={data.outletName}
              />

              <div className="mt-3">
                <Field label="Apa yang sudah diperbaiki?">
                  <Textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="mis. rak sudah dibersihkan dan dilap ulang"
                  />
                </Field>
              </div>

              <button
                type="button"
                onClick={submitProof}
                disabled={busy || shots.length === 0}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Kirim untuk diverifikasi
              </button>
            </div>
          )}

          {/* Pelapor: nilai hasilnya */}
          {status === "verifikasi" && isRaiser && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-1 text-sm font-semibold text-foreground">Bandingkan sebelum & sesudah</p>
              <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
                Kalau sudah bersih, terima. Kalau belum, kembalikan dengan catatan — temuannya akan menggantung lagi
                sampai supervisornya mengirim bukti baru.
              </p>

              <Field label="Catatan (wajib bila dikembalikan)">
                <Textarea
                  rows={2}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="mis. sudut kanan masih berdebu"
                />
              </Field>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => review(false)}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-500/50 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-40 dark:text-red-400"
                >
                  <RotateCcw className="size-4" /> Kembalikan
                </button>
                <button
                  type="button"
                  onClick={() => review(true)}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} ACC
                </button>
              </div>
            </div>
          )}

          {/* Penonton */}
          {((status === "menunggu" && !isAssignee) || (status === "verifikasi" && !isRaiser)) && (
            <p className="mt-5 rounded-xl border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              {status === "menunggu" ? (
                <>
                  Menunggu <span className="font-medium text-foreground">{data.assignedToName}</span> mengirim foto
                  bukti perbaikan.
                </>
              ) : (
                <>
                  Menunggu <span className="font-medium text-foreground">{data.raisedByName}</span> memeriksa hasil
                  perbaikannya.
                </>
              )}
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

function StatusBanner({
  status,
  label,
  tone,
  rounds,
}: {
  status: string;
  label: string;
  tone: "red" | "amber" | "emerald";
  rounds: number;
}) {
  const Icon = status === "selesai" ? CheckCircle2 : status === "verifikasi" ? Clock : TriangleAlert;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium",
        tone === "red" && "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
        tone === "amber" && "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        tone === "emerald" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {/* Berapa kali bolak-balik — angka ini yang membedakan "sekali beres"
          dari "tiga kali dikembalikan". */}
      {rounds > 1 && <span className="tabular-nums opacity-80">putaran ke-{rounds}</span>}
    </div>
  );
}

/** Satu putaran perbaikan: foto sesudah + penilaiannya. */
function AttemptBlock({ a, index, total }: { a: FollowupAttempt; index: number; total: number }) {
  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sesudah {total > 1 ? `· putaran ${index + 1}` : ""}
        </p>
        <Verdict a={a} />
      </div>

      {a.proof.length > 0 && (
        <div className={cn("grid gap-2", a.proof.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {a.proof.map((p) => (
            <Photo key={p.path} url={p.url} alt={p.name} />
          ))}
        </div>
      )}

      {a.note && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{a.note}</p>}
      <p className="mt-1 text-[11px] text-muted-foreground">
        {a.byName} · {stamp(a.at)}
      </p>

      {a.reviewNote && (
        <p
          className={cn(
            "mt-2 rounded-lg border p-2.5 text-[11px] leading-relaxed",
            a.verdict === "tolak"
              ? "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-300"
              : "border-border bg-muted/40 text-muted-foreground",
          )}
        >
          <span className="font-medium">{a.reviewedByName}:</span> {a.reviewNote}
        </p>
      )}
    </div>
  );
}

function Verdict({ a }: { a: FollowupAttempt }) {
  if (a.verdict === "acc") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3" /> Diterima
      </span>
    );
  }
  if (a.verdict === "tolak") {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
        <XCircle className="size-3" /> Dikembalikan
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
      <Clock className="size-3" /> Menunggu penilaian
    </span>
  );
}

function Photo({ url, alt, tall }: { url?: string; alt: string; tall?: boolean }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex justify-center overflow-hidden rounded-xl bg-muted/40 ring-1 ring-border"
    >
      {/* object-contain: foto tegak dari ponsel tidak dipangkas jadi landscape —
          bagian yang kotor justru sering ada di tepi atas atau bawah. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className={cn("w-auto max-w-full object-contain", tall ? "max-h-[45dvh]" : "max-h-56")} />
    </a>
  );
}

/** Waktu lengkap — temuan hygiene dinilai dari kapan tepatnya, bukan "2 jam lalu". */
function stamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
