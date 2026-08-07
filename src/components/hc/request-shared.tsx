"use client";

import * as React from "react";
import { Check, ChevronDown, FileText, GraduationCap, Image as ImageIcon, Palette, Paperclip, Upload, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DetailRows, DetailTitle, type DetailRow } from "@/components/ui/detail-rows";
import { presignHcUploadAction, uploadHcRequestFileAction } from "@/lib/actions/hc-requests";
import {
  fmtRupiah,
  requestSteps,
  statusMeta,
  type HcRequest,
  type HcRequestAttachment,
  type StepState,
} from "@/lib/hc-request";

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/** Chip unduh untuk satu lampiran. */
export function FileChip({ a }: { a: HcRequestAttachment }) {
  const isPdf = a.name.toLowerCase().endsWith(".pdf");
  const Icon = isPdf ? FileText : ImageIcon;
  const tone = isPdf ? "text-red-500" : "text-blue-500";
  if (!a.url) {
    return (
      <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
        <Paperclip className="size-3 shrink-0" /> <span className="truncate">{a.name}</span>
      </span>
    );
  }
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-background/40 px-1.5 py-0.5 text-[11px] text-foreground/80 hover:bg-muted/50"
    >
      <Icon className={cn("size-3 shrink-0", tone)} /> <span className="truncate">{a.name}</span>
    </a>
  );
}

/** Pemilih berkas (PDF/JPG/PNG) dengan validasi tipe & ukuran. */
export function FilePicker({ files, onChange, disabled, label = "Unggah berkas / foto" }: {
  files: File[];
  onChange: (f: File[]) => void;
  disabled?: boolean;
  label?: string;
}) {
  function add(list: FileList | null) {
    if (!list) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      if (f.type !== "application/pdf" && !f.type.startsWith("image/")) {
        toast.error(`"${f.name}" harus PDF atau gambar.`);
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`"${f.name}" melebihi 10 MB.`);
        continue;
      }
      ok.push(f);
    }
    onChange([...files, ...ok].slice(0, 10));
  }
  return (
    <div className="space-y-2">
      <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background/40 px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50", disabled && "pointer-events-none opacity-50")}>
        <Upload className="size-4" /> {label}
        <input type="file" accept="application/pdf,image/*" multiple className="hidden" disabled={disabled} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </label>
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-foreground/80">
              {f.type === "application/pdf" ? <FileText className="size-3.5 shrink-0 text-red-500" /> : <ImageIcon className="size-3.5 shrink-0 text-blue-500" />}
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
              <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="shrink-0 text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Ambang aman untuk melewati server action.
 *
 * Badan permintaan menuju fungsi serverless dibatasi beberapa MB dan ditolak
 * di lapisan platform — sebelum kode kita jalan — sehingga error-nya muncul
 * sebagai "an unexpected response was received from the server", bukan pesan
 * kita sendiri. Berkas di atas ambang ini naik langsung ke R2.
 */
const DIRECT_UPLOAD_MIN = 3 * 1024 * 1024;

/** Kemajuan unggahan yang dilaporkan ke pemanggil. */
export interface UploadProgress {
  /** Berkas ke berapa (1-based) dari total. */
  index: number;
  total: number;
  fileName: string;
  /** 0..1 untuk keseluruhan batch. */
  ratio: number;
}

/**
 * PUT ke R2 memakai XMLHttpRequest, bukan fetch.
 *
 * fetch tidak melaporkan kemajuan pengiriman, jadi berkas 7 MB tampak diam
 * belasan detik dan terbaca sebagai aplikasi menggantung. XHR punya
 * `upload.onprogress`, sehingga bilah kemajuannya benar-benar mengikuti byte
 * yang sudah terkirim — bukan animasi palsu.
 */
function putWithProgress(url: string, file: File, onBytes: (loaded: number) => void): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onBytes(e.loaded);
    };
    xhr.onload = () => resolve(xhr.status);
    xhr.onerror = () =>
      reject(new Error(`Gagal mengunggah "${file.name}" — koneksi ke penyimpanan ditolak (cek izin CORS bucket R2).`));
    xhr.onabort = () => reject(new Error(`Unggahan "${file.name}" dibatalkan.`));
    xhr.send(file);
  });
}

/** Unggah satu berkas langsung ke R2 memakai presigned URL. */
async function uploadDirect(file: File, onBytes: (loaded: number) => void): Promise<HcRequestAttachment | null> {
  const signed = await presignHcUploadAction({
    name: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
  });
  if (signed.error || !signed.url || !signed.path) {
    // R2 mati / tidak dikonfigurasi ⇒ biar pemanggil mencoba jalur biasa.
    if (signed.error && !signed.error.includes("R2 belum aktif")) throw new Error(signed.error);
    return null;
  }
  const status = await putWithProgress(signed.url, file, onBytes);
  if (status < 200 || status >= 300) {
    throw new Error(`Gagal mengunggah "${file.name}" — penyimpanan menolak (${status}).`);
  }
  return { path: signed.path, name: file.name };
}

export async function uploadAll(
  files: File[],
  onProgress?: (p: UploadProgress) => void,
): Promise<HcRequestAttachment[]> {
  const out: HcRequestAttachment[] = [];
  // Kemajuan dihitung dari total byte semua berkas, bukan jumlah berkas —
  // 1 PDF 7 MB dan 1 JPG 1 MB jelas tidak setara.
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0) || 1;
  let doneBytes = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const report = (loaded: number) =>
      onProgress?.({
        index: i + 1,
        total: files.length,
        fileName: file.name,
        ratio: Math.min(1, (doneBytes + loaded) / totalBytes),
      });
    report(0);

    if (file.size > DIRECT_UPLOAD_MIN) {
      const direct = await uploadDirect(file, report);
      if (direct) {
        out.push(direct);
        doneBytes += file.size;
        report(0);
        continue;
      }
    }
    const fd = new FormData();
    fd.append("file", file);
    const up = await uploadHcRequestFileAction(fd);
    if (up.error) throw new Error(up.error);
    if (up.path && up.name) out.push({ path: up.path, name: up.name });
    doneBytes += file.size;
    report(0);
  }
  return out;
}

/* ───────────────────────────── alur persetujuan ───────────────────────────── */

const DOT: Record<StepState, string> = {
  done: "border-emerald-500/45 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  current: "border-brand-500/55 bg-brand-500/15 text-brand-600 dark:text-brand-400",
  todo: "border-border bg-muted/60 text-muted-foreground",
  rejected: "border-red-500/45 bg-red-500/15 text-red-600 dark:text-red-400",
};
const RAIL: Record<StepState, string> = {
  done: "bg-emerald-500/45",
  current: "bg-brand-500/45",
  todo: "bg-border",
  rejected: "bg-red-500/45",
};

/**
 * Alur persetujuan sebagai daftar vertikal. Dipilih vertikal supaya label
 * sepanjang apa pun tetap terbaca utuh dan jarak antar langkah selalu sama —
 * versi horizontal selalu berakhir terpotong di layar sempit.
 */
export function RequestTimeline({ r }: { r: HcRequest }) {
  const steps = requestSteps(r);
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={s.label} className="flex gap-3">
          {/* Rel: bulatan langkah + garis penghubung dengan tinggi tetap. */}
          <div className="flex flex-col items-center">
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold", DOT[s.state])}>
              {s.state === "done" ? <Check className="size-3.5" /> : s.state === "rejected" ? <X className="size-3.5" /> : i + 1}
            </span>
            {i < steps.length - 1 && <span className={cn("w-px flex-1", RAIL[steps[i + 1].state === "todo" ? "todo" : s.state])} />}
          </div>
          <div className={cn("min-w-0 flex-1", i < steps.length - 1 && "pb-3")}>
            <p className={cn("text-xs leading-6", s.state === "todo" ? "text-muted-foreground" : "font-medium text-foreground")}>{s.label}</p>
            {s.detail && <p className="text-[11px] leading-tight text-muted-foreground">{s.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Detail lengkap satu pengajuan (isi panel yang terbuka saat kartu diklik). */
function RequestDetail({ r }: { r: HcRequest }) {
  const rows: DetailRow[] = [
    { label: "Departemen", value: r.department || "—" },
    { label: "Pemohon", value: r.requesterName },
    { label: "Diajukan", value: fmtDate(r.createdAt) },
  ];

  if (r.kind === "rekrutmen") {
    rows.push({ label: "Posisi", value: r.position || "—" });
    rows.push({ label: "Jumlah diminta", value: `${r.headcount} orang` });
    if (r.plannedDate) rows.push({ label: "Target mulai kerja", value: fmtDate(r.plannedDate) });
    if (r.status === "terlaksana") rows.push({ label: "Direkrut", value: `${r.recruited} orang` });
  } else if (r.kind === "pelatihan") {
    rows.push({ label: "Jenis pelatihan", value: r.trainingType || "—" });
    rows.push({ label: "Jumlah peserta", value: `${r.participants} orang` });
    rows.push({ label: "Estimasi biaya", value: fmtRupiah(r.budget) });
    if (r.budgetApproved > 0) rows.push({ label: "Dana disetujui", value: fmtRupiah(r.budgetApproved) });
    if (r.plannedDate) rows.push({ label: "Rencana pelaksanaan", value: fmtDate(r.plannedDate) });
  } else {
    rows.push({ label: "Jenis design", value: r.designType || "—" });
    if (r.designSize) rows.push({ label: "Ukuran / format", value: r.designSize });
    if (r.subjectName) rows.push({ label: "Untuk", value: r.subjectName });
    if (r.plannedDate) rows.push({ label: "Dibutuhkan", value: fmtDate(r.plannedDate) });
    // Pemohon berhak tahu siapa yang mengerjakan designnya.
    if (r.assigneeName) rows.push({ label: "Dikerjakan oleh", value: r.assigneeName });
  }

  const noteLabel = r.kind === "design" ? "Catatan Creative" : "Catatan HC";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-3">
        <div>
          <DetailTitle>Rincian</DetailTitle>
          <DetailRows rows={rows} />
        </div>

        {r.participantNames.length > 0 && (
          <div>
            <DetailTitle>Peserta</DetailTitle>
            <div className="flex flex-wrap gap-1">
              {r.participantNames.map((n) => (
                <span key={n} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] text-foreground/85">
                  <Users className="size-3 shrink-0 text-muted-foreground" />
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}

        {r.description && (
          <div>
            <DetailTitle>
              {r.kind === "rekrutmen" ? "Alasan permintaan" : r.kind === "design" ? "Brief design" : "Tujuan pelatihan"}
            </DetailTitle>
            <p className="whitespace-pre-wrap rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground/85">
              {r.description}
            </p>
          </div>
        )}

        {r.attachments.length > 0 && (
          <div>
            <DetailTitle>Lampiran</DetailTitle>
            <div className="flex flex-wrap gap-1.5">
              {r.attachments.map((a, i) => <FileChip key={i} a={a} />)}
            </div>
            {r.revisions.length > 0 && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                Sudah {r.revisions.length}× revisi — berkas hasil terbaru ada di urutan paling akhir.
              </p>
            )}
          </div>
        )}

        {(r.hcNote || r.financeNote) && (
          <div>
            <DetailTitle>Catatan</DetailTitle>
            <DetailRows
              rows={[
                { label: noteLabel, value: r.hcNote, skipEmpty: true },
                { label: "Catatan Finance", value: r.financeNote, skipEmpty: true },
              ]}
            />
          </div>
        )}

        {/* Riwayat revisi ditampilkan utuh — tim Creative perlu tahu apa saja
            yang sudah pernah diminta, bukan hanya permintaan terakhir. */}
        {r.revisions.length > 0 && (
          <div>
            <DetailTitle>Permintaan Revisi ({r.revisions.length})</DetailTitle>
            <ol className="space-y-1.5">
              {r.revisions.map((v, i) => (
                <li key={i} className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] p-2.5">
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    Revisi {i + 1} · {v.byName} · {fmtDate(v.at)}
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-foreground/85">{v.note}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div>
        <DetailTitle>Alur Persetujuan</DetailTitle>
        <RequestTimeline r={r} />
      </div>
    </div>
  );
}

/** Satu kartu pengajuan — bentuknya sama persis dengan kartu di Pengajuan
 *  Dokumen: tile ikon, judul, subjudul, badge status, keterangan di kanan.
 *  Diketuk untuk membuka rincian & alur persetujuan. */
function RequestCard({
  r,
  open,
  onToggle,
  actions,
}: {
  r: HcRequest;
  open: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
}) {
  const st = statusMeta(r.kind, r.status);
  const steps = requestSteps(r);
  const active = steps.find((s) => s.state === "current");
  const Icon = r.kind === "pelatihan" ? GraduationCap : r.kind === "design" ? Palette : UserPlus;
  const bodyId = `req-${r.id}`;

  // Nama yang dituju selalu ikut tampil — supaya jelas ini untuk siapa.
  const who = r.subjectName || (r.participantNames.length > 0 ? r.participantNames.join(", ") : "");
  const subtitle =
    r.kind === "rekrutmen"
      ? `${r.position || "Posisi belum diisi"} · ${r.headcount} orang`
      : r.kind === "design"
        ? `${r.designType || "Jenis belum diisi"}${who ? ` · ${who}` : ""}${r.revisions.length ? ` · revisi ke-${r.revisions.length}` : ""}`
        : `${r.trainingType || "Jenis belum diisi"} · ${r.participants} peserta${who ? ` · ${who}` : ""}`;

  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      {/* Badge diletakkan di baris sendiri di bawah judul: label status di sini
          bisa sepanjang "Menunggu ACC Finance", dan bila diletakkan sebaris ia
          menyusutkan judul sampai hilang di layar ponsel. */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{r.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge tone={st.tone}>{st.label}</Badge>
              <span className="text-[11px] text-muted-foreground">
                {r.requesterName} · {fmtDate(r.createdAt)}
                {active ? ` · menunggu ${active.label}` : ""}
              </span>
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={onToggle}
            aria-label={open ? "Tutup rincian" : "Lihat rincian"}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
          </button>
        </div>
      </div>

      <div id={bodyId} className={cn("grid transition-[grid-template-rows] duration-200", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="mt-3 border-t border-border pt-3">
            <RequestDetail r={r} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Daftar pengajuan. Hanya satu kartu terbuka sekaligus. */
export function RequestList({
  rows,
  actions,
}: {
  rows: HcRequest[];
  actions?: (r: HcRequest) => React.ReactNode;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <RequestCard
          key={r.id}
          r={r}
          open={openId === r.id}
          onToggle={() => setOpenId((cur) => (cur === r.id ? null : r.id))}
          actions={actions?.(r)}
        />
      ))}
    </div>
  );
}

/** Kotak kosong bergaris putus-putus — sama dengan daftar Pengajuan Dokumen. */
export function RequestEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
