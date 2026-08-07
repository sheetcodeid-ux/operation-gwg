"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CircleUser, ExternalLink, Link2, Loader2, MonitorCog, Paperclip, Plus, Store, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, useDialogControl } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { submitSystemRequestAction, uploadSystemAttachmentAction } from "@/lib/actions/system";
import { uploadOne } from "@/lib/upload-client";
import { ProofGrid } from "@/components/system/system-review";
import { DetailRows, DetailTitle } from "@/components/ui/detail-rows";
import { StatusFilter } from "@/components/ui/status-filter";
import {
  SYS_REQUEST_TYPES,
  SYS_STATUS_META,
  SYS_TYPE_LABEL,
  SYS_URGENCY_META,
  type SysRequestType,
  type SysStatus,
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
          <Plus /> Ajukan Permintaan
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Formulir Pengajuan Dukungan Sistem"
        description="Sampaikan kebutuhan atau kendala sistem Anda selengkap mungkin agar tim System Support dapat menindaklanjuti dengan cepat dan tepat."
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
  const [file, setFile] = useState<File | null>(null);

  const outletName = outlets.find((o) => o.id === outletId)?.name ?? "—";

  function submit() {
    if (!title.trim()) return toast.error("Judul permintaan wajib diisi.");
    if (!description.trim()) return toast.error("Uraian permintaan wajib diisi.");
    if (!outletId) return toast.error("Cabang wajib dipilih.");

    startTransition(async () => {
      let attachmentPath: string | null = null;
      let attachmentName: string | null = null;
      if (file) {
        try {
          const up = await uploadOne("system", file, uploadSystemAttachmentAction);
          attachmentPath = up.path;
          attachmentName = up.name;
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Gagal mengunggah berkas.");
          return;
        }
      }
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
        attachmentPath,
        attachmentName,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Permintaan berhasil dikirim ke tim System Support.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="max-h-[76vh] space-y-3 overflow-y-auto p-5">
      {/* Auto-filled identity */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informasi Pemohon</p>
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
      </div>

      <Field label="Nomor WhatsApp Aktif" hint="Untuk konfirmasi tindak lanjut. Contoh: 082154860207">
        <Input
          value={waNumber}
          onChange={(e) => setWaNumber(e.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          placeholder="082154860207"
        />
      </Field>

      <div className="border-t border-border pt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detail Permintaan</p>

        <Field label="Jenis Permintaan">
          <Combobox
            value={requestType}
            onChange={(v) => setRequestType(v as SysRequestType)}
            options={SYS_REQUEST_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
        </Field>

        <Field label="Judul Permintaan" className="mt-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ringkas dalam satu kalimat — mis. 'Aplikasi kasir gagal login sejak pagi'"
          />
        </Field>

        <Field label="Uraian Lengkap" className="mt-3">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Jelaskan selengkap mungkin: apa yang terjadi, sejak kapan, langkah yang sudah dicoba, atau detail fitur yang diharapkan."
            rows={4}
          />
        </Field>

        <Field label="Dampak bila Tertunda" className="mt-3" hint="Bantu tim menilai prioritas penanganan.">
          <Textarea
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            placeholder="Contoh: Transaksi kasir terhenti sehingga menimbulkan antrean panjang dan potensi kehilangan penjualan."
            rows={2}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tingkat Urgensi">
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

      <Field label="Lampiran Pendukung (opsional)" hint="Unggah foto/berkas (maks 10 MB) atau tempel tautan Google Drive.">
        <div className="space-y-2">
          <FilePick file={file} onPick={setFile} />
          {!file && (
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={attachmentLink}
                onChange={(e) => setAttachmentLink(e.target.value)}
                placeholder="atau tempel tautan: https://drive.google.com/…"
                className="pl-9"
              />
            </div>
          )}
        </div>
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Batal
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Kirim Permintaan
        </Button>
      </div>
    </div>
  );
}

function FilePick({ file, onPick }: { file: File | null; onPick: (f: File | null) => void }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 self-start rounded-lg border border-input bg-background/40 px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50">
        <Upload className="size-4" />
        {file ? "Ganti berkas" : "Unggah foto / berkas"}
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      </label>
      {file && (
        <span className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-foreground/80">
          <Paperclip className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <button type="button" onClick={() => onPick(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </span>
      )}
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

/** Daftar permintaan sistem milik pemohon — kartu yang bisa dibuka + penyaring
 *  status, seragam dengan halaman Pengajuan lainnya. */
export function SystemRequestList({ rows }: { rows: SystemRequest[] }) {
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = (v: SysStatus) => rows.filter((r) => r.status === v).length;
  const shown = status ? rows.filter((r) => r.status === status) : rows;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Belum ada permintaan. Klik “Ajukan Permintaan” untuk mengirim kebutuhan Anda ke tim System Support.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <StatusFilter
        value={status}
        onChange={setStatus}
        allCount={rows.length}
        options={(["waiting", "processing", "done"] as SysStatus[]).map((v) => ({
          value: v,
          label: SYS_STATUS_META[v].label,
          count: counts(v),
        }))}
      />

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Tidak ada permintaan dengan status ini.
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map((r) => {
            const st = SYS_STATUS_META[r.status];
            const ur = SYS_URGENCY_META[r.urgency];
            const open = openId === r.id;
            const toggle = () => setOpenId((cur) => (cur === r.id ? null : r.id));
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    aria-controls={`sys-${r.id}`}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <MonitorCog className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{r.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {SYS_TYPE_LABEL[r.requestType]} · {r.outletName}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <Badge tone={ur.tone}>{ur.label}</Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {r.requesterName} · {fmtDate(r.createdAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label={open ? "Tutup rincian" : "Lihat rincian"}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
                  </button>
                </div>

                <div id={`sys-${r.id}`} className={cn("grid transition-[grid-template-rows] duration-200", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="overflow-hidden">
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      <DetailRows
                        rows={[
                          { label: "Jenis permintaan", value: SYS_TYPE_LABEL[r.requestType] },
                          { label: "Cabang", value: r.outletName },
                          { label: "Pemohon", value: `${r.requesterName}${r.position ? ` — ${r.position}` : ""}` },
                          { label: "Nomor WA", value: r.waNumber, skipEmpty: true },
                          { label: "Tingkat urgensi", value: ur.label },
                          { label: "Dibutuhkan", value: r.neededDate ? fmtDate(r.neededDate) : "", skipEmpty: true },
                          { label: "Diajukan", value: fmtDate(r.createdAt) },
                          { label: "Ditangani", value: r.handlerName, skipEmpty: true },
                          { label: "Selesai", value: r.completedAt ? fmtDate(r.completedAt) : "", skipEmpty: true },
                        ]}
                      />

                      {r.description && (
                        <div>
                          <DetailTitle>Uraian</DetailTitle>
                          <p className="whitespace-pre-wrap rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground/85">
                            {r.description}
                          </p>
                        </div>
                      )}

                      {r.impact && (
                        <div>
                          <DetailTitle>Dampak bila tidak ditangani</DetailTitle>
                          <p className="whitespace-pre-wrap rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground/85">
                            {r.impact}
                          </p>
                        </div>
                      )}

                      {r.note && (
                        <div>
                          <DetailTitle>Catatan System Support</DetailTitle>
                          <p className="whitespace-pre-wrap rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground/85">
                            {r.note}
                          </p>
                        </div>
                      )}

                      {r.attachmentUrl && (
                        <div>
                          <DetailTitle>Lampiran</DetailTitle>
                          <a
                            href={r.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background/40 px-2 py-1 text-[11px] text-foreground/80 hover:bg-muted/50"
                          >
                            <ExternalLink className="size-3 shrink-0" />
                            <span className="truncate">{r.attachmentName ?? "Buka lampiran"}</span>
                          </a>
                        </div>
                      )}

                      {r.status === "done" && r.resultUrls.length > 0 && (
                        <div>
                          <DetailTitle>Bukti perbaikan dari System Support</DetailTitle>
                          <ProofGrid urls={r.resultUrls} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
