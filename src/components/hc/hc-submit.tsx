"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, FileText, FileUp, Loader2, Paperclip, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger, useDialogControl } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { DetailRows, DetailTitle } from "@/components/ui/detail-rows";
import { StatusFilter } from "@/components/ui/status-filter";
import {
  BilahModul,
  KerangkaModul,
  useLayarPenuh,
} from "@/components/hcmos/kit-modul";
import { cn } from "@/lib/utils";
import { submitHcRequestAction, uploadHcKtpAction } from "@/lib/actions/hc";
import { uploadOne } from "@/lib/upload-client";
import { pesanGalatAksi } from "@/lib/chunk-recovery";
import {
  HC_DOC_LABEL,
  HC_DOC_TYPES,
  HC_STATUS_META,
  HC_NEEDS_CHRONOLOGY,
  HC_CONTRACT_LIKE,
  HC_PROMOSI_LIKE,
  type HcDetails,
  type HcDocType,
  type HcStatus,
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
    if (HC_NEEDS_CHRONOLOGY.includes(docType) && !details.chronology?.trim()) return toast.error("Kronologi wajib diisi.");

    // SELURUH badan pengiriman terbungkus.
    //
    // Server action yang melempar galat tak tertangkap muncul di layar sebagai
    // "An error occurred in the Server Components render. The specific message
    // is omitted in production builds" — kalimat yang tidak memberi tahu apa
    // pun, dan yang paling sering menyebabkannya bukan galat di dalam aksinya
    // melainkan halaman yang masih memegang versi lama setelah aplikasi
    // diperbarui. `pesanGalatAksi` menyebut sebab itu dan memuat ulang
    // halamannya, karena tanpa muat ulang percobaan berikutnya pasti gagal
    // lagi dengan cara yang sama.
    startTransition(async () => {
      try {
        let ktpPath: string | null = null;
        const outgoing: HcDetails = { ...details };
        if (ktp) {
          ktpPath = (await uploadOne("hcdoc", ktp, uploadHcKtpAction)).path;
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
      } catch (e) {
        toast.error(pesanGalatAksi(e));
      }
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

      {HC_CONTRACT_LIKE.includes(docType) && (
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

      {/* Surat Promosi. Kalimat inti suratnya persis "dari jabatan A menjadi
          jabatan B", jadi jabatan lamanya bukan tambahan — tanpa itu suratnya
          tidak bisa ditulis, dan HC harus menanyakannya lewat chat satu per
          satu. Tidak ada durasi di sini: promosi mengubah jabatan, bukan masa
          kontrak. */}
      {HC_PROMOSI_LIKE.includes(docType) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Jabatan Sebelumnya">
            <Input
              value={details.previousPosition ?? ""}
              onChange={(e) => setD({ previousPosition: e.target.value })}
              placeholder="cth. Barista"
            />
          </Field>
          <Field label="Jabatan Baru">
            <Input value={details.position ?? ""} onChange={(e) => setD({ position: e.target.value })} placeholder="cth. Shift Leader" />
          </Field>
          <Field label="Berlaku Mulai">
            <DatePicker value={details.startDate ?? ""} onChange={(v) => setD({ startDate: v })} />
          </Field>
          <Field label="Gaji Baru (opsional)">
            <Input value={details.salary ?? ""} onChange={(e) => setD({ salary: e.target.value })} placeholder="cth. 3.500.000" />
          </Field>
        </div>
      )}

      {HC_NEEDS_CHRONOLOGY.includes(docType) && (
        <Field label={docType === "phk" ? "Alasan / Kronologi PHK" : "Kronologi Pelanggaran"}>
          <Textarea
            value={details.chronology ?? ""}
            onChange={(e) => setD({ chronology: e.target.value })}
            placeholder="Jelaskan kronologi & pelanggaran yang dilakukan…"
            rows={4}
          />
        </Field>
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

/** Daftar pengajuan dokumen milik pemohon — kartu yang bisa dibuka + penyaring
 *  status, seragam dengan halaman Pengajuan lainnya. */
export function SubmissionList({ rows }: { rows: HcSubmission[] }) {
  const [status, setStatus] = useState("");
  const [cari, setCari] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const { bingkai, layarPenuh, alih } = useLayarPenuh();

  const counts = (v: HcStatus) => rows.filter((r) => r.status === v).length;

  /**
   * Pencarian nama karyawan.
   *
   * Supervisor yang aktif mengirim belasan pengajuan sebulan, dan yang
   * ditanyakan cabang biasanya "surat si anu sudah jadi belum" — pertanyaan
   * tentang satu nama, bukan tentang satu status.
   */
  const q = cari.trim().toLowerCase();
  const shown = (status ? rows.filter((r) => r.status === status) : rows).filter(
    (r) => !q || `${r.employeeName ?? ""} ${r.docType} ${r.outletName ?? ""}`.toLowerCase().includes(q),
  );

  return (
    <KerangkaModul ref={bingkai}>
      <BilahModul
        ikon={FileUp}
        gradien="from-sky-500 via-cyan-500 to-teal-500 shadow-cyan-500/20"
        judul="Pengajuan Dokumen Karyawan"
        ringkas={
          rows.length === 0
            ? "Belum ada pengajuan — klik Ajukan Dokumen untuk mengirim permintaan ke Human Capital"
            : `${rows.length} pengajuan · ${counts("waiting") + counts("processing") + counts("pending")} berjalan · ${counts("done")} selesai`
        }
        cari={cari}
        onCari={setCari}
        cariPlaceholder="Cari nama karyawan, jenis dokumen…"
        hitung={{ tampil: shown.length, total: rows.length }}
        menyaring={q !== "" || status !== ""}
        onBersihkan={() => {
          setCari("");
          setStatus("");
        }}
        panduan="hc_pengajuan"
        layarPenuh={layarPenuh}
        onLayarPenuh={alih}
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3">
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Belum ada pengajuan. Klik “Ajukan Dokumen” untuk mengirim permintaan ke Human Capital.
        </div>
      ) : (
        <>
      <StatusFilter
        value={status}
        onChange={setStatus}
        allCount={rows.length}
        options={(["waiting", "processing", "pending", "done", "rejected"] as HcStatus[]).map((v) => ({
          value: v,
          label: HC_STATUS_META[v].label,
          count: counts(v),
        }))}
      />

      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Tidak ada pengajuan dengan status ini.
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map((r) => {
            const st = HC_STATUS_META[r.status];
            const open = openId === r.id;
            const toggle = () => setOpenId((cur) => (cur === r.id ? null : r.id));
            const d = r.details ?? {};
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    aria-controls={`doc-${r.id}`}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{r.employeeName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {HC_DOC_LABEL[r.docType]} · {r.outletName}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {r.supervisorName} · {fmtDate(r.createdAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    {r.status === "done" && r.finalDocUrl && (
                      <a href={r.finalDocUrl} download>
                        <Button size="sm" variant="subtle">
                          <Download className="size-4" /> Unduh
                        </Button>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={toggle}
                      aria-label={open ? "Tutup rincian" : "Lihat rincian"}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ChevronDown className={cn("size-4 transition-transform duration-200", open && "rotate-180")} />
                    </button>
                  </div>
                </div>

                <div id={`doc-${r.id}`} className={cn("grid transition-[grid-template-rows] duration-200", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <div className="overflow-hidden">
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      <DetailRows
                        rows={[
                          { label: "Nama karyawan", value: r.employeeName },
                          { label: "Jenis dokumen", value: HC_DOC_LABEL[r.docType] },
                          { label: "Cabang", value: r.outletName },
                          { label: "Diajukan oleh", value: r.supervisorName },
                          { label: "Tanggal pengajuan", value: fmtDate(r.createdAt) },
                          { label: "Nama ibu kandung", value: d.motherName, skipEmpty: true },
                          { label: "Jabatan sebelumnya", value: d.previousPosition, skipEmpty: true },
                          { label: r.docType === "promosi" ? "Jabatan baru" : "Posisi / jabatan", value: d.position, skipEmpty: true },
                          { label: "Durasi kontrak", value: d.contractDuration, skipEmpty: true },
                          { label: "Tanggal mulai", value: d.startDate ? fmtDate(d.startDate) : "", skipEmpty: true },
                          { label: "Gaji", value: d.salary, skipEmpty: true },
                          { label: "Tingkat teguran", value: d.warningLevel, skipEmpty: true },
                          { label: "Diproses oleh", value: r.processedByName, skipEmpty: true },
                          { label: "Diselesaikan oleh", value: r.completedByName, skipEmpty: true },
                          { label: "Tanggal selesai", value: r.completedAt ? fmtDate(r.completedAt) : "", skipEmpty: true },
                        ]}
                      />

                      {d.chronology && (
                        <div>
                          <DetailTitle>Kronologi</DetailTitle>
                          <p className="whitespace-pre-wrap rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground/85">
                            {d.chronology}
                          </p>
                        </div>
                      )}

                      {r.hcNote && (
                        <div>
                          {/* Judulnya menyesuaikan: pada pengajuan yang batal,
                              isi kolom ini adalah ALASANNYA — dan itu yang
                              dicari pemohonnya, bukan "keterangan". */}
                          <DetailTitle>
                            {r.status === "rejected" ? "Alasan Pembatalan" : "Keterangan Human Capital"}
                          </DetailTitle>
                          <p className="whitespace-pre-wrap rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed text-foreground/85">
                            {r.hcNote}
                          </p>
                        </div>
                      )}

                      {r.ktpUrl && (
                        <div>
                          <DetailTitle>Berkas KTP</DetailTitle>
                          <a
                            href={r.ktpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-background/40 px-2 py-1 text-[11px] text-foreground/80 hover:bg-muted/50"
                          >
                            <Paperclip className="size-3 shrink-0" />
                            <span className="truncate">{d.ktpName ?? "Buka berkas KTP"}</span>
                          </a>
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
        </>
      )}
      </div>
    </KerangkaModul>
  );
}
