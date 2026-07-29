"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, FileUp, Loader2, Paperclip, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, useDialogControl } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { submitHcRequestAction, uploadHcKtpAction } from "@/lib/actions/hc";
import {
  forceDownload,
  HC_DOC_LABEL,
  HC_DOC_TYPES,
  HC_STATUS_META,
  HC_WARNING_LEVELS,
  type HcDetails,
  type HcDocType,
  type HcSubmission,
} from "@/lib/hc-shared";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function NewSubmissionButton({ outlets }: { outlets: { id: string; name: string }[] }) {
  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm" disabled={outlets.length === 0}>
          <Plus /> Ajukan Dokumen
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Pengajuan Dokumen Karyawan"
        description="Kirim permintaan dokumen ke tim Human Capital untuk diproses."
        align="center"
        className="max-w-lg"
      >
        <SubmissionForm outlets={outlets} />
      </DialogContent>
    </Dialog>
  );
}

function SubmissionForm({ outlets }: { outlets: { id: string; name: string }[] }) {
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, startTransition] = useTransition();

  const [employeeName, setEmployeeName] = useState("");
  const [docType, setDocType] = useState<HcDocType>("bpjs");
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "");
  const [ktp, setKtp] = useState<File | null>(null);
  const [details, setDetails] = useState<HcDetails>({});

  const setD = (patch: Partial<HcDetails>) => setDetails((d) => ({ ...d, ...patch }));

  function submit() {
    if (!employeeName.trim()) return toast.error("Nama karyawan wajib diisi.");
    if (!outletId) return toast.error("Cabang wajib dipilih.");
    if (docType === "bpjs" && !details.motherName?.trim()) return toast.error("Nama ibu kandung wajib untuk BPJS.");
    if (docType === "teguran" && !details.chronology?.trim()) return toast.error("Kronologi pelanggaran wajib diisi.");

    startTransition(async () => {
      let ktpPath: string | null = null;
      const outgoing: HcDetails = { ...details };
      if (ktp) {
        const fd = new FormData();
        fd.append("file", ktp);
        const up = await uploadHcKtpAction(fd);
        if (up.error) {
          toast.error(up.error);
          return;
        }
        ktpPath = up.path ?? null;
        outgoing.ktpName = ktp.name; // keep the original filename (e.g. dfsfs.jpg)
      }
      const res = await submitHcRequestAction({ employeeName: employeeName.trim(), docType, outletId, ktpPath, details: outgoing });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Pengajuan terkirim ke Human Capital.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="max-h-[72vh] space-y-3 overflow-y-auto p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama Karyawan">
          <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="Nama lengkap" />
        </Field>
        <Field label="Cabang">
          <Combobox
            value={outletId}
            onChange={setOutletId}
            options={outlets.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Pilih cabang"
            searchPlaceholder="Cari cabang…"
          />
        </Field>
      </div>

      <Field label="Jenis Pengajuan">
        <Combobox
          value={docType}
          onChange={(v) => setDocType(v as HcDocType)}
          options={HC_DOC_TYPES.map((d) => ({ value: d.value, label: d.label }))}
        />
      </Field>

      {/* Doc-type-specific fields */}
      {docType === "bpjs" && (
        <Field label="Nama Ibu Kandung">
          <Input
            value={details.motherName ?? ""}
            onChange={(e) => setD({ motherName: e.target.value })}
            placeholder="Untuk pendaftaran BPJS"
          />
        </Field>
      )}

      {docType === "pkwt" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Posisi / Jabatan">
            <Input value={details.position ?? ""} onChange={(e) => setD({ position: e.target.value })} placeholder="cth. Barista" />
          </Field>
          <Field label="Durasi Kontrak">
            <Input value={details.contractDuration ?? ""} onChange={(e) => setD({ contractDuration: e.target.value })} placeholder="cth. 12 bulan" />
          </Field>
          <Field label="Tanggal Mulai">
            <DatePicker value={details.startDate ?? ""} onChange={(v) => setD({ startDate: v })} />
          </Field>
          <Field label="Gaji (opsional)">
            <Input value={details.salary ?? ""} onChange={(e) => setD({ salary: e.target.value })} placeholder="cth. 3.000.000" />
          </Field>
        </div>
      )}

      {docType === "teguran" && (
        <>
          <Field label="Tingkat Teguran">
            <Combobox
              value={details.warningLevel ?? HC_WARNING_LEVELS[0]}
              onChange={(v) => setD({ warningLevel: v })}
              options={HC_WARNING_LEVELS.map((w) => ({ value: w, label: w }))}
            />
          </Field>
          <Field label="Kronologi Pelanggaran">
            <Textarea
              value={details.chronology ?? ""}
              onChange={(e) => setD({ chronology: e.target.value })}
              placeholder="Jelaskan kronologi & pelanggaran yang dilakukan…"
              rows={4}
            />
          </Field>
        </>
      )}

      <Field label="Scan / Foto KTP" hint="Gambar atau PDF, maks 8 MB. Opsional bila belum tersedia.">
        <FilePick file={ktp} onPick={setKtp} accept="image/*,application/pdf" />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Batal
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Kirim Pengajuan
        </Button>
      </div>
    </div>
  );
}

/** Small file picker with selected-file chip. */
function FilePick({ file, onPick, accept }: { file: File | null; onPick: (f: File | null) => void; accept: string }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 self-start rounded-lg border border-input bg-background/40 px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50">
        <FileUp className="size-4" />
        {file ? "Ganti berkas" : "Pilih berkas"}
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
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

/** The supervisor's own list of submissions (read-only, download when done). */
export function SubmissionList({ rows }: { rows: HcSubmission[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Belum ada pengajuan. Klik “Ajukan Dokumen” untuk mengirim permintaan ke Human Capital.
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {rows.map((r) => {
        const st = HC_STATUS_META[r.status];
        return (
          <div key={r.id} className="rounded-xl border border-border bg-card p-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{r.employeeName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {HC_DOC_LABEL[r.docType]} · {r.outletName} · {fmtDate(r.createdAt)}
                </p>
              </div>
              <Badge tone={st.tone}>{st.label}</Badge>
              {r.status === "done" && r.finalDocUrl ? (
                <a href={forceDownload(r.finalDocUrl, `${r.employeeName} - ${HC_DOC_LABEL[r.docType]}.pdf`)} download>
                  <Button size="sm" variant="subtle">
                    <Download className="size-4" /> Unduh
                  </Button>
                </a>
              ) : r.status === "waiting" || r.status === "processing" ? (
                <span className="text-xs text-muted-foreground">Menunggu HC</span>
              ) : null}
            </div>
            {/* Awaiting the file, or done via note only (e.g. BPJS): show HC's keterangan. */}
            {(r.status === "pending" || (r.status === "done" && !r.finalDocUrl)) && r.hcNote && (
              <p className="mt-2 whitespace-pre-wrap rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <span className="font-medium">Keterangan HC:</span> {r.hcNote}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
