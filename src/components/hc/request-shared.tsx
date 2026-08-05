"use client";

import * as React from "react";
import { Check, ChevronDown, FileText, Image as ImageIcon, Paperclip, Upload, Users, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { uploadHcRequestFileAction } from "@/lib/actions/hc-requests";
import {
  HC_REQUEST_KIND_LABEL,
  HC_REQUEST_STATUS_META,
  fmtRupiah,
  requestSteps,
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

/** Unggah semua berkas → daftar lampiran tersimpan. Melempar bila ada yang gagal. */
export async function uploadAll(files: File[]): Promise<HcRequestAttachment[]> {
  const out: HcRequestAttachment[] = [];
  for (const file of files) {
    const fd = new FormData();
    fd.append("file", file);
    const up = await uploadHcRequestFileAction(fd);
    if (up.error) throw new Error(up.error);
    if (up.path && up.name) out.push({ path: up.path, name: up.name });
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

/** Satu baris ringkas "Label — isi", tanpa pemotongan teks. */
function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 font-medium text-foreground">{children}</span>
    </div>
  );
}

/** Detail lengkap satu pengajuan (isi panel yang terbuka saat kartu diklik). */
function RequestDetail({ r }: { r: HcRequest }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rincian</p>
        <Line label="Departemen">{r.department}</Line>
        <Line label="Pemohon">{r.requesterName}</Line>
        <Line label="Diajukan">{fmtDate(r.createdAt)}</Line>
        {r.kind === "rekrutmen" ? (
          <>
            <Line label="Posisi">{r.position || "—"}</Line>
            <Line label="Jumlah diminta">{r.headcount} orang</Line>
            {r.plannedDate && <Line label="Target mulai kerja">{fmtDate(r.plannedDate)}</Line>}
            {r.status === "terlaksana" && <Line label="Direkrut">{r.recruited} orang</Line>}
          </>
        ) : (
          <>
            <Line label="Jenis pelatihan">{r.trainingType || "—"}</Line>
            <Line label="Jumlah peserta">{r.participants} orang</Line>
            <Line label="Estimasi biaya">{fmtRupiah(r.budget)}</Line>
            {r.budgetApproved > 0 && <Line label="Dana disetujui">{fmtRupiah(r.budgetApproved)}</Line>}
            {r.plannedDate && <Line label="Rencana pelaksanaan">{fmtDate(r.plannedDate)}</Line>}
          </>
        )}

        {r.participantNames.length > 0 && (
          <div className="pt-1">
            <p className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Users className="size-3" /> Peserta
            </p>
            <div className="flex flex-wrap gap-1">
              {r.participantNames.map((n) => (
                <span key={n} className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] text-foreground/85">{n}</span>
              ))}
            </div>
          </div>
        )}

        {r.description && (
          <div className="pt-1">
            <p className="mb-1 text-[11px] text-muted-foreground">{r.kind === "rekrutmen" ? "Alasan permintaan" : "Tujuan pelatihan"}</p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/85">{r.description}</p>
          </div>
        )}

        {r.attachments.length > 0 && (
          <div className="pt-1">
            <p className="mb-1 text-[11px] text-muted-foreground">Lampiran</p>
            <div className="flex flex-wrap gap-1.5">
              {r.attachments.map((a, i) => <FileChip key={i} a={a} />)}
            </div>
          </div>
        )}

        {(r.hcNote || r.financeNote) && (
          <div className="space-y-1 pt-1">
            {r.hcNote && (
              <p className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Catatan HC:</span> {r.hcNote}
              </p>
            )}
            {r.financeNote && (
              <p className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Catatan Finance:</span> {r.financeNote}
              </p>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Alur Persetujuan</p>
        <RequestTimeline r={r} />
      </div>
    </div>
  );
}

/** Satu baris pengajuan di dalam daftar. Tertutup: judul, status, dan langkah
 *  yang sedang berjalan. Terbuka: rincian penuh + alur persetujuan. */
function RequestRow({
  r,
  open,
  onToggle,
  actions,
  first,
}: {
  r: HcRequest;
  open: boolean;
  onToggle: () => void;
  actions?: React.ReactNode;
  first: boolean;
}) {
  const st = HC_REQUEST_STATUS_META[r.status];
  const steps = requestSteps(r);
  const active = steps.find((s) => s.state === "current" || s.state === "rejected");
  const doneCount = steps.filter((s) => s.state === "done").length;
  const bodyId = `req-${r.id}`;

  const subtitle =
    r.kind === "rekrutmen"
      ? `${r.position || "Posisi belum diisi"} · ${r.headcount} orang`
      : `${r.trainingType || "Jenis belum diisi"} · ${r.participants} peserta`;

  return (
    <div className={cn(!first && "border-t border-border", open && "bg-muted/25")}>
      <div className="flex flex-wrap items-start gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg bg-muted ring-1 ring-border">
            <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{r.title}</span>
              <Badge tone={st.tone}>{st.label}</Badge>
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {HC_REQUEST_KIND_LABEL[r.kind]} · {subtitle}
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {r.department} · {r.requesterName} · {fmtDate(r.createdAt)} ·{" "}
              {active ? `menunggu ${active.label}` : `${doneCount}/${steps.length} langkah selesai`}
            </span>
          </span>
        </button>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <div id={bodyId} className={cn("grid transition-[grid-template-rows] duration-200", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="border-t border-border/60 px-4 py-4">
            <RequestDetail r={r} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Daftar pengajuan sebagai satu kartu berbaris — bentuk yang sama dipakai tabel
 * lain di aplikasi. Hanya satu baris terbuka sekaligus: membuka yang lain
 * menutup yang sedang terbuka.
 */
export function RequestList({
  rows,
  actions,
}: {
  rows: HcRequest[];
  actions?: (r: HcRequest) => React.ReactNode;
}) {
  const [openId, setOpenId] = React.useState<string | null>(null);
  return (
    <div className="glass overflow-hidden rounded-2xl border border-border">
      {rows.map((r, i) => (
        <RequestRow
          key={r.id}
          r={r}
          first={i === 0}
          open={openId === r.id}
          onToggle={() => setOpenId((cur) => (cur === r.id ? null : r.id))}
          actions={actions?.(r)}
        />
      ))}
    </div>
  );
}
