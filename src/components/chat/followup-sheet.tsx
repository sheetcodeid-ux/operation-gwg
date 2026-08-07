"use client";

import * as React from "react";
import { Camera, CheckCircle2, Loader2, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Field, Textarea } from "@/components/ui/input";
import { hygieneFollowupAction, hygieneResolveFollowupAction } from "@/lib/actions/hygiene-followup";
import { uploadChatFiles } from "./upload";
import { formatDate } from "@/lib/utils";
import type { HygieneFollowup } from "@/lib/chat-shared";

/**
 * Temuan hygiene yang dibuka dari obrolan.
 *
 * Supervisor yang ditugaskan bisa menutupnya DI SINI — tapi hanya dengan foto
 * bukti perbaikan. Tanpa foto, tombolnya mati dan servernya pun menolak; kalau
 * temuan bisa ditutup dengan sekadar mengetik "sudah", seluruh gunanya hilang.
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
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!followupId) return;
    setData(null);
    setNote("");
    setFiles([]);
    setLoading(true);
    let alive = true;
    void hygieneFollowupAction(followupId).then((d) => {
      if (!alive) return;
      setData(d);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [followupId]);

  const mine = data?.assignedTo === meId;
  const pending = data?.status === "menunggu";

  async function resolve() {
    if (!data) return;
    if (files.length === 0) return toast.error("Wajib melampirkan foto bukti perbaikan.");
    setBusy(true);
    try {
      const proof = await uploadChatFiles(files);
      const res = await hygieneResolveFollowupAction({ id: data.id, resolution: note, proof });
      if (res.error) return toast.error(res.error);
      toast.success("Tindak lanjut tercatat");
      onResolved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim tindak lanjut.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet
      open={followupId !== null}
      onOpenChange={(v) => !v && onClose()}
      title="Temuan Hygiene"
      description={data ? `${data.area || "Area"} · ${data.outletName}` : undefined}
      className="sm:max-w-lg"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : !data ? (
        <p className="px-5 py-12 text-center text-sm text-muted-foreground">Temuan tidak ditemukan.</p>
      ) : (
        <div className="px-5 pb-6">
          <div
            className={`mb-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
              pending
                ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {pending ? <TriangleAlert className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
            {pending ? "Belum ditindaklanjuti" : `Ditindaklanjuti ${data.resolvedAt ? formatDate(data.resolvedAt) : ""}`}
          </div>

          {data.photoUrl && (
            <a href={data.photoUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl ring-1 ring-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.photoUrl} alt={data.area} className="max-h-72 w-full object-cover" />
            </a>
          )}

          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{data.note}</p>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Dilaporkan {data.raisedByName} · {formatDate(data.createdAt)} · ditujukan ke {data.assignedToName}
          </p>

          {!pending && (
            <>
              <p className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bukti Perbaikan
              </p>
              {data.resolution && (
                <p className="mb-2 whitespace-pre-wrap text-sm text-foreground">{data.resolution}</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {data.proof.map((a) => (
                  <a
                    key={a.path}
                    href={a.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block overflow-hidden rounded-xl ring-1 ring-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.name} className="aspect-square w-full object-cover" />
                  </a>
                ))}
              </div>
            </>
          )}

          {pending && mine && (
            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-3 text-sm font-semibold text-foreground">Tandai sudah ditindaklanjuti</p>

              <Field label="Apa yang sudah diperbaiki?">
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="mis. rak sudah dibersihkan dan dilap ulang"
                />
              </Field>

              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-muted-foreground transition-colors hover:bg-muted/50">
                <Camera className="size-4" />
                {files.length > 0 ? `${files.length} foto dipilih` : "Ambil / pilih foto bukti"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const picked = Array.from(e.target.files ?? []);
                    const tooBig = picked.filter((f) => f.size > 10 * 1024 * 1024);
                    if (tooBig.length > 0) toast.error(`${tooBig[0].name} melebihi 10 MB.`);
                    setFiles((cur) => [...cur, ...picked.filter((f) => f.size <= 10 * 1024 * 1024)]);
                    e.target.value = "";
                  }}
                />
              </label>

              {files.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {files.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="relative overflow-hidden rounded-lg ring-1 ring-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={URL.createObjectURL(f)} alt={f.name} className="aspect-square w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                        className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-black/60 text-white"
                        aria-label={`Buang ${f.name}`}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Foto bukti wajib. Tanpa foto, temuan tetap terbuka — itu yang membuat catatan ini bisa dipercaya.
              </p>

              <button
                type="button"
                onClick={resolve}
                disabled={busy || files.length === 0}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Sudah dilakukan tindak lanjut
              </button>
            </div>
          )}

          {pending && !mine && (
            <p className="mt-5 rounded-xl border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
              Menunggu <span className="font-medium text-foreground">{data.assignedToName}</span> menutup temuan ini
              dengan foto bukti perbaikan.
            </p>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
