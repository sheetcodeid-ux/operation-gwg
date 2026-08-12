"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  CircleUser,
  ExternalLink,
  ImagePlus,
  Inbox,
  ListChecks,
  Loader2,
  Lock,
  MonitorCog,
  Send,
  Trash2,
  UserCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Textarea } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { StageFilterChips } from "@/components/ui/stage-filter";
import { DiscussButton } from "@/components/chat/forward-request";
import { cn } from "@/lib/utils";
import {
  completeSystemRequestAction,
  deleteSystemRequestAction,
  processSystemRequestAction,
  uploadSystemResultAction,
} from "@/lib/actions/system";
import {
  SYS_STATUS_META,
  SYS_TYPE_LABEL,
  SYS_URGENCY_META,
  type SysStatus,
  type SystemRequest,
} from "@/lib/system-shared";

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

const STATUS_FILTERS: { value: SysStatus | "all"; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "waiting", label: "Menunggu" },
  { value: "processing", label: "Diproses" },
  { value: "done", label: "Selesai" },
];

export function SystemReviewPanel({
  rows,
  handlers,
  canDelete = false,
}: {
  rows: SystemRequest[];
  handlers: { id: string; name: string }[];
  canDelete?: boolean;
}) {
  const [filter, setFilter] = useState<SysStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const counts = useMemo(() => {
    const c = { waiting: 0, processing: 0, done: 0 };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* Left — Antrean */}
      <div className="flex flex-col rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-3">
          <div className="mb-2.5 flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
            <Inbox className="size-4 text-muted-foreground" /> Antrean System
            <span className="ml-auto text-xs font-normal text-muted-foreground">{rows.length} total</span>
          </div>
          {/* Chip yang sama persis dengan antrian Design & Dokumen HC. */}
          <StageFilterChips
            options={STATUS_FILTERS}
            value={filter}
            onChange={setFilter}
            count={(v) => (v === "all" ? rows.length : counts[v])}
          />
        </div>
        <div className="max-h-[70vh] space-y-1.5 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">Tidak ada request pada filter ini.</p>
          )}
          {filtered.map((r) => {
            const st = SYS_STATUS_META[r.status];
            const ur = SYS_URGENCY_META[r.urgency];
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
                  <p className="min-w-0 truncate text-sm font-medium text-foreground">{r.title}</p>
                  <Badge tone={st.tone} className="shrink-0">{st.label}</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{SYS_TYPE_LABEL[r.requestType]}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Badge tone={ur.tone} className="px-1.5 py-0 text-[10px]">{ur.label}</Badge>
                  <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                    {r.outletName} · {r.requesterName}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right — Detail */}
      <div className="min-w-0 rounded-2xl border border-border bg-card">
        {selected ? (
          <DetailPanel key={selected.id} row={selected} handlers={handlers} canDelete={canDelete} onDeleted={() => setSelectedId(null)} />
        ) : (
          <div className="grid h-full min-h-[40vh] place-items-center p-10 text-center text-sm text-muted-foreground">
            <div>
              <MonitorCog className="mx-auto mb-3 size-8 text-muted-foreground/50" />
              Pilih satu request dari antrean untuk melihat detail.
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
      <span className="w-44 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

function DetailPanel({
  row,
  handlers,
  canDelete,
  onDeleted,
}: {
  row: SystemRequest;
  handlers: { id: string; name: string }[];
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [handlerId, setHandlerId] = useState(row.handlerId ?? handlers[0]?.id ?? "");
  const [note, setNote] = useState(row.note ?? "");
  const [resultFiles, setResultFiles] = useState<File[]>([]);
  const st = SYS_STATUS_META[row.status];
  const ur = SYS_URGENCY_META[row.urgency];

  function process() {
    if (!handlerId) {
      toast.error("Pilih penanggung jawab (PIC) terlebih dahulu.");
      return;
    }
    startTransition(async () => {
      const res = await processSystemRequestAction({ id: row.id, handlerId, note });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Diteruskan ke Work Tracker & pengaju diberi tahu.");
      router.refresh();
    });
  }

  function complete() {
    startTransition(async () => {
      // Upload proof-of-repair photos (if any) straight to storage first.
      const resultPaths: string[] = [];
      for (const file of resultFiles) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await uploadSystemResultAction(fd);
        if (up.error) {
          toast.error(up.error);
          return;
        }
        if (up.path) resultPaths.push(up.path);
      }
      const res = await completeSystemRequestAction({ id: row.id, resultPaths });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Request ditandai selesai.");
      router.refresh();
    });
  }

  function remove() {
    if (!confirm(`Hapus request "${row.title}"? Tindakan ini permanen.`)) return;
    startTransition(async () => {
      const res = await deleteSystemRequestAction(row.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Request dihapus.");
      onDeleted();
      router.refresh();
    });
  }

  return (
    <div className="max-h-[74vh] overflow-y-auto p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold text-foreground">{row.title}</h2>
          <p className="text-sm text-muted-foreground">{SYS_TYPE_LABEL[row.requestType]}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={ur.tone}>{ur.label}</Badge>
          <Badge tone={st.tone}>{st.label}</Badge>
          {canDelete && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              title="Hapus request (Super Admin)"
              className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Read-only requester data */}
      <div className="mt-4 space-y-2.5 rounded-xl border border-border bg-muted/20 p-4">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <CircleUser className="size-3.5" /> Data Pengaju
        </p>
        <InfoRow label="Nama" value={row.requesterName} />
        <InfoRow label="Jabatan" value={row.position} />
        <InfoRow label="Cabang" value={row.outletName} />
        <InfoRow
          label="Nomor WhatsApp"
          value={
            row.waNumber ? (
              <a href={`https://wa.me/${row.waNumber.replace(/^0/, "62")}`} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-400">
                {row.waNumber}
              </a>
            ) : (
              "—"
            )
          }
        />
        <InfoRow label="Tanggal Pengajuan" value={fmtDateTime(row.createdAt)} />
        {row.neededDate && <InfoRow label="Tanggal Dibutuhkan" value={fmtDate(row.neededDate)} />}
        <InfoRow label="Deskripsi" value={<span className="whitespace-pre-wrap">{row.description}</span>} />
        {row.impact && <InfoRow label="Dampak" value={<span className="whitespace-pre-wrap">{row.impact}</span>} />}
        {row.attachmentUrl && (
          <InfoRow
            label="Lampiran Pendukung"
            value={
              <a href={row.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-brand-600 hover:underline dark:text-brand-400">
                <ExternalLink className="size-3.5" /> {row.attachmentName ?? "Buka lampiran"}
              </a>
            }
          />
        )}
      </div>

      {/* Bertanya balik ke pemohon sebelum memutuskan — sama seperti antrian
          Design & Permintaan HC. Request-nya ikut terlampir sebagai kartu,
          jadi tidak perlu menjelaskan ulang yang mana. */}
      <div className="mt-4">
        <DiscussButton
          source="system"
          requestId={row.id}
          requestTitle={row.title}
          suggestedIds={[row.requesterId]}
          label="Tanya"
        />
      </div>

      {/* System Support actions */}
      {row.status === "waiting" && (
        <div className="mt-4 space-y-3 rounded-xl border border-border p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <UserCog className="size-3.5" /> Teruskan ke Work Tracker
          </p>
          <Field label="Penanggung Jawab (PIC)">
            <Combobox
              value={handlerId}
              onChange={setHandlerId}
              options={handlers.map((h) => ({ value: h.id, label: h.name }))}
              placeholder="Pilih PIC"
              searchPlaceholder="Cari nama…"
            />
          </Field>
          <Field label="Catatan (opsional)">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan untuk PIC / internal…" rows={2} />
          </Field>
          <div className="flex justify-end">
            <Button onClick={process} disabled={pending} className="shrink-0">
              {pending ? <Loader2 className="animate-spin" /> : <Send className="size-4" />} Proses & Buat Task
            </Button>
          </div>
        </div>
      )}

      {(row.status === "processing" || row.status === "done") && (
        <div className="mt-4 space-y-3 rounded-xl border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Penanganan System Support</p>
          <InfoRow label="Dikerjakan oleh" value={row.handlerName} />
          {row.processedByName && <InfoRow label="Diproses oleh" value={row.processedByName} />}
          {row.note && <InfoRow label="Catatan" value={<span className="whitespace-pre-wrap">{row.note}</span>} />}
          {row.workTaskId && (
            <Link href="/work-tracker" className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline dark:text-brand-400">
              <ListChecks className="size-4" /> Lihat task di Work Tracker
            </Link>
          )}

          {row.status === "processing" ? (
            <div className="space-y-3 border-t border-border pt-3">
              <Field label="Foto Bukti Perbaikan (opsional)" hint="Lampirkan foto hasil perbaikan agar Supervisor bisa melihat buktinya.">
                <ResultPicker files={resultFiles} onChange={setResultFiles} />
              </Field>
              <div className="flex justify-end">
                <Button onClick={complete} disabled={pending} className="shrink-0">
                  {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="size-4" />} Tandai Selesai
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                <Lock className="size-4 shrink-0" /> Selesai
                {row.completedAt ? ` · ${fmtDateTime(row.completedAt)}` : ""}
              </div>
              {row.resultUrls.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Bukti Perbaikan</p>
                  <ProofGrid urls={row.resultUrls} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Multi-photo picker for proof-of-repair (local preview before upload). */
function ResultPicker({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  return (
    <div className="space-y-2">
      <label className="inline-flex cursor-pointer items-center gap-2 self-start rounded-lg border border-input bg-background/40 px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50">
        <ImagePlus className="size-4" /> Tambah foto
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (picked.length) onChange([...files, ...picked]);
          }}
        />
      </label>
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {files.map((f, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(f)} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Grid of proof-of-repair photos (tap to open full-size). */
export function ProofGrid({ urls }: { urls: string[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {urls.map((u, i) => (
        <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="group relative aspect-square overflow-hidden rounded-lg ring-1 ring-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt={`Bukti ${i + 1}`} loading="lazy" className="size-full object-cover transition-transform group-hover:scale-105" />
        </a>
      ))}
    </div>
  );
}
