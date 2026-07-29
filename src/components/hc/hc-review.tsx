"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  IdCard,
  Inbox,
  Loader2,
  Lock,
  Play,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  completeHcRequestAction,
  deleteHcRequestAction,
  holdHcRequestAction,
  startHcProcessingAction,
  uploadHcFinalAction,
} from "@/lib/actions/hc";
import {
  forceDownload,
  HC_DOC_LABEL,
  HC_STATUS_META,
  isImageUrl,
  type HcStatus,
  type HcSubmission,
} from "@/lib/hc-shared";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_FILTERS: { value: HcStatus | "all"; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "waiting", label: "Menunggu" },
  { value: "processing", label: "Diproses" },
  { value: "pending", label: "Menunggu Berkas" },
  { value: "done", label: "Selesai" },
];

export function HcReviewPanel({ rows, canDelete = false }: { rows: HcSubmission[]; canDelete?: boolean }) {
  const [filter, setFilter] = useState<HcStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const counts = useMemo(() => {
    const c: Record<HcStatus, number> = { waiting: 0, processing: 0, pending: 0, done: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* Left — Antrean Masuk */}
      <div className="flex flex-col rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-3">
          <div className="mb-2.5 flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
            <Inbox className="size-4 text-muted-foreground" /> Antrean Masuk
            <span className="ml-auto text-xs font-normal text-muted-foreground">{rows.length} total</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const n = f.value === "all" ? rows.length : counts[f.value];
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    filter === f.value
                      ? "bg-brand-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/70",
                  )}
                >
                  {f.label} <span className="tabular-nums opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="max-h-[70vh] space-y-1.5 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">Tidak ada pengajuan pada filter ini.</p>
          )}
          {filtered.map((r) => {
            const st = HC_STATUS_META[r.status];
            const active = r.id === selectedId;
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  active ? "border-brand-500/50 bg-brand-500/5" : "border-transparent hover:bg-muted/50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-foreground">{r.employeeName}</p>
                  <Badge tone={st.tone} className="shrink-0">{st.label}</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{HC_DOC_LABEL[r.docType]}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {r.outletName} · SPV {r.supervisorName}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">{fmtDateTime(r.createdAt)}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right — Detail Pengajuan */}
      <div className="min-w-0 rounded-2xl border border-border bg-card">
        {selected ? (
          <DetailPanel key={selected.id} row={selected} canDelete={canDelete} onDeleted={() => setSelectedId(null)} />
        ) : (
          <div className="grid h-full min-h-[40vh] place-items-center p-10 text-center text-sm text-muted-foreground">
            <div>
              <FileText className="mx-auto mb-3 size-8 text-muted-foreground/50" />
              Pilih satu pengajuan dari antrean untuk melihat detail.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="w-40 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

/** KTP shown as a file entry (keeps the original name, e.g. "dfsfs.jpg").
 *  Tapping "Buka" opens an image in a framed lightbox like the Hygiene photos,
 *  or opens a PDF in a new tab; "Download" saves the file to the device. */
function KtpViewer({ url, name, employeeName }: { url: string; name: string; employeeName: string }) {
  const [open, setOpen] = useState(false);
  const isImg = name ? isImageUrl(name) : isImageUrl(url);
  const label = name || (isImg ? "KTP.jpg" : "KTP.pdf");
  const dl = forceDownload(url, name || `KTP ${employeeName}`);

  const openFile = () => {
    if (isImg) setOpen(true);
    else window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-2.5">
        <button
          type="button"
          onClick={openFile}
          className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted ring-1 ring-border transition-transform hover:scale-[1.03]"
          aria-label="Buka KTP"
        >
          {isImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`KTP ${employeeName}`} className="size-full object-cover" />
          ) : (
            <IdCard className="size-5 text-brand-600 dark:text-brand-400" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{isImg ? "Foto KTP" : "Dokumen KTP (PDF)"}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={openFile}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ExternalLink className="size-3.5" /> Buka
          </button>
          <a
            href={dl}
            download
            className="inline-flex items-center gap-1 rounded-lg bg-brand-500/10 px-2 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-500/20 dark:text-brand-400"
          >
            <Download className="size-3.5" /> Download
          </a>
        </div>
      </div>

      {/* Framed lightbox — same look as the Hygiene documentation viewer. */}
      {open && isImg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="Tutup"
          >
            <X className="size-5" />
          </button>
          <div className="flex max-h-full max-w-3xl flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/15">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`KTP ${employeeName}`} className="max-h-[78vh] w-auto object-contain" />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/80">
                <span className="font-medium text-white/95">{label}</span> · KTP {employeeName}
              </span>
              <a
                href={dl}
                download
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25"
              >
                <Download className="size-3.5" /> Download
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailPanel({ row, canDelete, onDeleted }: { row: HcSubmission; canDelete: boolean; onDeleted: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(row.hcNote ?? "");
  const [finalFile, setFinalFile] = useState<File | null>(null);
  const st = HC_STATUS_META[row.status];
  const locked = row.status === "done";
  const d = row.details;

  function startProcessing() {
    startTransition(async () => {
      const res = await startHcProcessingAction(row.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Status diubah ke Diproses.");
      router.refresh();
    });
  }

  const isBpjs = row.docType === "bpjs";

  /** Upload the finished document and mark the request Selesai. */
  function complete() {
    if (!finalFile) {
      toast.error("Unggah dokumen jadi (PDF) terlebih dahulu.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", finalFile);
      const up = await uploadHcFinalAction(fd);
      if (up.error) {
        toast.error(up.error);
        return;
      }
      const res = await completeHcRequestAction({ id: row.id, note, finalDocPath: up.path ?? "" });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Dokumen dikirim balik ke Supervisor.");
      router.refresh();
    });
  }

  /** Processing → Menunggu Berkas: record info (e.g. No. BPJS), await the file. */
  function hold() {
    if (!note.trim()) {
      toast.error(isBpjs ? "Isi No. BPJS/KPJ dulu di catatan." : "Isi keterangan dulu.");
      return;
    }
    startTransition(async () => {
      const res = await holdHcRequestAction({ id: row.id, note });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Ditandai Menunggu Berkas. Unggah berkas nanti untuk menyelesaikan.");
      router.refresh();
    });
  }

  function remove() {
    if (!confirm(`Hapus pengajuan "${row.employeeName}"? Tindakan ini permanen.`)) return;
    startTransition(async () => {
      const res = await deleteHcRequestAction(row.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Pengajuan dihapus.");
      onDeleted();
      router.refresh();
    });
  }

  return (
    <div className="max-h-[74vh] overflow-y-auto p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-foreground">{row.employeeName}</h2>
          <p className="text-sm text-muted-foreground">{HC_DOC_LABEL[row.docType]}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={st.tone}>{st.label}</Badge>
          {canDelete && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              title="Hapus pengajuan (Super Admin)"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Read-only supervisor data */}
      <div className="mt-4 space-y-2.5 rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <User className="size-3.5" /> Data dari Supervisor
        </p>
        <InfoRow label="Supervisor" value={row.supervisorName} />
        <InfoRow label="Cabang" value={row.outletName} />
        <InfoRow label="Nama Karyawan" value={row.employeeName} />
        <InfoRow label="Tanggal Pengajuan" value={fmtDateTime(row.createdAt)} />

        {row.docType === "bpjs" && <InfoRow label="Nama Ibu Kandung" value={d.motherName} />}
        {row.docType === "pkwt" && (
          <>
            <InfoRow label="Posisi / Jabatan" value={d.position} />
            <InfoRow label="Durasi Kontrak" value={d.contractDuration} />
            <InfoRow label="Tanggal Mulai" value={d.startDate} />
            <InfoRow label="Gaji" value={d.salary} />
          </>
        )}
        {row.docType === "teguran" && (
          <>
            <InfoRow label="Tingkat Teguran" value={d.warningLevel} />
            <InfoRow label="Kronologi" value={<span className="whitespace-pre-wrap">{d.chronology}</span>} />
          </>
        )}

        {/* KTP — neat framed preview + download */}
        <div className="flex flex-col gap-1.5 pt-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">File KTP</span>
          {row.ktpUrl ? (
            <KtpViewer url={row.ktpUrl} name={row.details.ktpName ?? ""} employeeName={row.employeeName} />
          ) : (
            <span className="text-sm text-muted-foreground">Tidak dilampirkan</span>
          )}
        </div>
      </div>

      {/* HC actions */}
      {row.status === "waiting" && (
        <div className="mt-4 flex flex-col items-start gap-2 rounded-xl border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Mulai proses agar pengajuan ini tercatat sedang Anda kerjakan.</p>
          <Button onClick={startProcessing} disabled={pending} className="shrink-0">
            {pending ? <Loader2 className="animate-spin" /> : <Play className="size-4" />} Mulai Proses
          </Button>
        </div>
      )}

      {(row.status === "processing" || row.status === "pending" || row.status === "done") && (
        <div className="mt-4 space-y-3 rounded-xl border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hasil Human Capital</p>

          {locked ? (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4 shrink-0" />
                <span className="min-w-0 break-words">
                  Selesai oleh {row.completedByName ?? "HC"}
                  {row.completedAt ? ` · ${fmtDateTime(row.completedAt)}` : ""}
                </span>
              </div>
              {row.hcNote && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Catatan untuk Supervisor</p>
                  <p className="whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-sm text-foreground">{row.hcNote}</p>
                </div>
              )}
              {row.finalDocUrl && (
                <a href={forceDownload(row.finalDocUrl, `${row.employeeName} - ${HC_DOC_LABEL[row.docType]}.pdf`)} download>
                  <Button variant="subtle" size="sm">
                    <Download className="size-4" /> Unduh Dokumen Jadi
                  </Button>
                </a>
              )}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5 shrink-0" /> Pengajuan terkunci (read-only). Revisi = buat pengajuan baru.
              </p>
            </>
          ) : row.status === "pending" ? (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
                <Clock className="size-4 shrink-0" /> Menunggu berkas terbit — unggah berkas untuk menyelesaikan.
              </div>
              {row.hcNote && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Keterangan{isBpjs ? " (No. BPJS/KPJ)" : ""}</p>
                  <p className="whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-3 text-sm text-foreground">{row.hcNote}</p>
                </div>
              )}
              <Field label="Unggah Berkas (PDF)" hint={isBpjs ? "Setelah kartu BPJS terbit, unggah di sini untuk menyelesaikan." : "Setelah berkas terbit, unggah di sini untuk menyelesaikan."}>
                <FinalFilePick file={finalFile} onPick={setFinalFile} />
              </Field>
              <Field label="Perbarui Keterangan (opsional)">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
              </Field>
              <div className="flex justify-end">
                <Button onClick={complete} disabled={pending} className="shrink-0">
                  {pending ? <Loader2 className="animate-spin" /> : <Send className="size-4" />} Unggah Berkas & Selesaikan
                </Button>
              </div>
            </>
          ) : (
            <>
              <Field label="Upload Dokumen Jadi (PDF)" hint="Hasil dokumen final yang akan diunduh Supervisor. Maks 8 MB.">
                <FinalFilePick file={finalFile} onPick={setFinalFile} />
              </Field>
              <Field label={isBpjs ? "Catatan / No. BPJS (untuk Supervisor)" : "Catatan untuk Supervisor (opsional)"}>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={isBpjs ? "Contoh: No. BPJS 0001234567890" : "Tambahkan catatan bila perlu…"} rows={3} />
              </Field>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="subtle" onClick={hold} disabled={pending} className="shrink-0">
                  <Clock className="size-4" /> {isBpjs ? "Tandai Menunggu Kartu" : "Tandai Menunggu Berkas"}
                </Button>
                <Button onClick={complete} disabled={pending} className="shrink-0">
                  {pending ? <Loader2 className="animate-spin" /> : <Send className="size-4" />} Kirim Balik ke Supervisor
                </Button>
              </div>
              {isBpjs && (
                <p className="text-[11px] text-muted-foreground">
                  Kartu belum terbit? Isi No. BPJS di catatan lalu tekan <b>Tandai Menunggu Kartu</b> — unggah kartunya nanti untuk menyelesaikan.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FinalFilePick({ file, onPick }: { file: File | null; onPick: (f: File | null) => void }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 self-start rounded-lg border border-input bg-background/40 px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50">
        <FileUp className="size-4" />
        {file ? "Ganti PDF" : "Pilih PDF"}
        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      </label>
      {file && (
        <span className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-foreground/80">
          <FileText className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <button type="button" onClick={() => onPick(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </span>
      )}
    </div>
  );
}
