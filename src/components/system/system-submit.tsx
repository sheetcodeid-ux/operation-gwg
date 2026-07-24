"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleUser, ExternalLink, Link2, Loader2, MonitorCog, Plus, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, useDialogControl } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { submitSystemRequestAction } from "@/lib/actions/system";
import {
  SYS_REQUEST_TYPES,
  SYS_STATUS_META,
  SYS_TYPE_LABEL,
  SYS_URGENCY_META,
  type SysRequestType,
  type SysUrgency,
  type SystemRequest,
} from "@/lib/system-shared";
import { TONE_PILL } from "@/components/ui/tone";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

const URGENCIES: SysUrgency[] = ["urgent", "normal", "low"];

export function NewSystemRequestButton({
  requesterName,
  outlets,
}: {
  requesterName: string;
  outlets: { id: string; name: string }[];
}) {
  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm" disabled={outlets.length === 0}>
          <Plus /> Ajukan Request
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Pengajuan System / IT Support"
        description="Kirim permintaan fitur, perbaikan bug, akses, atau kendala sistem ke tim System Support."
        align="center"
        className="max-w-lg"
      >
        <SystemRequestForm requesterName={requesterName} outlets={outlets} />
      </DialogContent>
    </Dialog>
  );
}

function SystemRequestForm({ requesterName, outlets }: { requesterName: string; outlets: { id: string; name: string }[] }) {
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, startTransition] = useTransition();

  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "");
  const [waNumber, setWaNumber] = useState("");
  const [requestType, setRequestType] = useState<SysRequestType>("fitur");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState("");
  const [urgency, setUrgency] = useState<SysUrgency>("normal");
  const [neededDate, setNeededDate] = useState("");
  const [attachmentLink, setAttachmentLink] = useState("");

  const outletName = outlets.find((o) => o.id === outletId)?.name ?? "—";

  function submit() {
    if (!title.trim()) return toast.error("Judul request wajib diisi.");
    if (!description.trim()) return toast.error("Deskripsi request wajib diisi.");
    if (!outletId) return toast.error("Cabang wajib dipilih.");
    startTransition(async () => {
      const res = await submitSystemRequestAction({
        outletId,
        waNumber,
        requestType,
        title: title.trim(),
        description,
        impact,
        urgency,
        neededDate,
        attachmentLink,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Request terkirim ke System Support.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="max-h-[74vh] space-y-3 overflow-y-auto p-5">
      {/* Auto-filled identity */}
      <div className="grid gap-2.5 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-3">
        <AutoField icon={<CircleUser className="size-3.5" />} label="Nama" value={requesterName} />
        <AutoField icon={<CircleUser className="size-3.5" />} label="Jabatan" value="Supervisor" />
        {outlets.length > 1 ? (
          <Field label="Cabang">
            <Combobox
              value={outletId}
              onChange={setOutletId}
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Pilih cabang"
              searchPlaceholder="Cari cabang…"
            />
          </Field>
        ) : (
          <AutoField icon={<Store className="size-3.5" />} label="Cabang" value={outletName} />
        )}
      </div>

      <Field label="Nomor WhatsApp" hint="Format: 082154860207">
        <Input
          value={waNumber}
          onChange={(e) => setWaNumber(e.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          placeholder="082154860207"
        />
      </Field>

      <div className="border-t border-border pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detail Request</p>

        <Field label="Jenis Request">
          <Combobox
            value={requestType}
            onChange={(v) => setRequestType(v as SysRequestType)}
            options={SYS_REQUEST_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
        </Field>

        <Field label="Judul Request" className="mt-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tulis ringkas. Contoh: 'Kasir tidak bisa login'"
          />
        </Field>

        <Field label="Deskripsi Lengkap Request" className="mt-3">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Jelaskan detail kebutuhan, langkah untuk mereproduksi masalah, atau fitur yang diinginkan."
            rows={4}
          />
        </Field>

        <Field label="Dampak Jika Tidak Segera Ditangani" className="mt-3">
          <Textarea
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            placeholder="Contoh: Kasir tidak bisa transaksi sejak pagi, menyebabkan antrean panjang."
            rows={2}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Urgensi">
          <div className="flex gap-1.5">
            {URGENCIES.map((u) => {
              const meta = SYS_URGENCY_META[u];
              const active = urgency === u;
              return (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUrgency(u)}
                  className={cn(
                    "flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors",
                    active ? cn(TONE_PILL[meta.tone], "border-transparent") : "border-input text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Tanggal Dibutuhkan">
          <DatePicker value={neededDate} onChange={setNeededDate} />
        </Field>
      </div>

      <Field label="Foto Pendukung (jika ada)" hint="Upload foto/screenshot ke Google Drive, lalu tempel link-nya di sini.">
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={attachmentLink}
            onChange={(e) => setAttachmentLink(e.target.value)}
            placeholder="https://drive.google.com/…"
            className="pl-9"
          />
        </div>
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Batal
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Kirim Request
        </Button>
      </div>
    </div>
  );
}

function AutoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-xs font-medium text-foreground/80">{icon} {label}</span>
      <span className="truncate rounded-lg bg-background/50 px-2.5 py-1.5 text-sm text-foreground">{value}</span>
    </div>
  );
}

/** The supervisor's own list of system requests (read-only + status). */
export function SystemRequestList({ rows }: { rows: SystemRequest[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Belum ada request. Klik “Ajukan Request” untuk mengirim permintaan ke System Support.
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const st = SYS_STATUS_META[r.status];
        const ur = SYS_URGENCY_META[r.urgency];
        return (
          <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3.5">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
              <MonitorCog className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {SYS_TYPE_LABEL[r.requestType]} · {r.outletName} · {fmtDate(r.createdAt)}
              </p>
            </div>
            <Badge tone={ur.tone} className="shrink-0">{ur.label}</Badge>
            <Badge tone={st.tone} className="shrink-0">{st.label}</Badge>
            {r.attachmentLink && (
              <a href={r.attachmentLink} target="_blank" rel="noopener noreferrer" title="Lampiran" className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
