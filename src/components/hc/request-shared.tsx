"use client";

import * as React from "react";
import { Check, FileText, Image as ImageIcon, Paperclip, Upload, X } from "lucide-react";
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
      <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
        <Paperclip className="size-3" /> <span className="max-w-[8rem] truncate">{a.name}</span>
      </span>
    );
  }
  return (
    <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-background/40 px-1.5 py-0.5 text-[11px] text-foreground/80 hover:bg-muted/50">
      <Icon className={cn("size-3 shrink-0", tone)} /> <span className="max-w-[8rem] truncate">{a.name}</span>
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

const DOT: Record<StepState, string> = {
  done: "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  current: "border-brand-500/50 bg-brand-500/15 text-brand-600 dark:text-brand-400",
  todo: "border-border bg-muted/60 text-muted-foreground",
  rejected: "border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400",
};
const BAR: Record<StepState, string> = {
  done: "bg-emerald-500/40",
  current: "bg-brand-500/40",
  todo: "bg-border",
  rejected: "bg-red-500/40",
};

/** Stepper alur persetujuan — posisi berkas terlihat sekali lihat. */
export function RequestTimeline({ r }: { r: HcRequest }) {
  const steps = requestSteps(r);
  return (
    <ol className="flex items-start gap-1 overflow-x-auto pb-0.5">
      {steps.map((s, i) => (
        <li key={s.label} className="flex min-w-0 flex-1 items-start gap-1">
          <div className="flex min-w-0 flex-1 flex-col items-center text-center">
            <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold", DOT[s.state])}>
              {s.state === "done" ? <Check className="size-3.5" /> : s.state === "rejected" ? <X className="size-3.5" /> : i + 1}
            </span>
            <span
              className={cn(
                "mt-1 max-w-full truncate text-[11px] leading-tight",
                s.state === "todo" ? "text-muted-foreground" : "font-medium text-foreground",
              )}
              title={s.label}
            >
              {s.label}
            </span>
            {s.detail && <span className="max-w-full truncate text-[10px] text-muted-foreground" title={s.detail}>{s.detail}</span>}
          </div>
          {i < steps.length - 1 && <span className={cn("mt-3 h-px min-w-4 flex-1", BAR[steps[i + 1].state === "todo" ? s.state : steps[i + 1].state])} />}
        </li>
      ))}
    </ol>
  );
}

/** Ringkasan satu pengajuan — dipakai di daftar pemohon, HC, dan Finance. */
export function RequestSummary({ r, children, timeline }: { r: HcRequest; children?: React.ReactNode; timeline?: boolean }) {
  const st = HC_REQUEST_STATUS_META[r.status];
  return (
    <div className="card-gradient rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            <Badge tone={r.kind === "pelatihan" ? "cyan" : "brand"}>{HC_REQUEST_KIND_LABEL[r.kind]}</Badge>
          </div>
          <p className="mt-1.5 truncate text-sm font-semibold text-foreground">{r.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {r.department} · {r.requesterName} · {fmtDate(r.createdAt)}
          </p>
          {r.kind === "rekrutmen" ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Posisi <span className="font-medium text-foreground">{r.position || "—"}</span> · diminta{" "}
              <span className="font-medium text-foreground">{r.headcount}</span> orang
              {r.plannedDate && <> · target mulai {fmtDate(r.plannedDate)}</>}
              {r.status === "terlaksana" && <> · direkrut <span className="font-medium text-foreground">{r.recruited}</span></>}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {r.trainingType || "—"} · {r.participants} peserta · estimasi {fmtRupiah(r.budget)}
              {r.budgetApproved > 0 && <> · disetujui <span className="font-medium text-foreground">{fmtRupiah(r.budgetApproved)}</span></>}
              {r.plannedDate && <> · rencana {fmtDate(r.plannedDate)}</>}
            </p>
          )}
          {r.description && <p className="mt-1 line-clamp-2 max-w-2xl text-xs text-muted-foreground/80">{r.description}</p>}
          {r.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.attachments.map((a, i) => <FileChip key={i} a={a} />)}
            </div>
          )}
          {(r.hcNote || r.financeNote) && (
            <div className="mt-2 space-y-1 text-[11px]">
              {r.hcNote && <p className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-muted-foreground"><span className="font-medium text-foreground">Catatan HC:</span> {r.hcNote}</p>}
              {r.financeNote && <p className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-muted-foreground"><span className="font-medium text-foreground">Catatan Finance:</span> {r.financeNote}</p>}
            </div>
          )}
        </div>
        {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
      </div>
      {timeline && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <RequestTimeline r={r} />
        </div>
      )}
    </div>
  );
}
