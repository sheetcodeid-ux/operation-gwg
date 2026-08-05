"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Textarea } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Sheet, SheetContent, SheetTrigger, useSheetControl } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/page-header";
import { myHcRequestsAction, submitHcRequestAction } from "@/lib/actions/hc-requests";
import { TRAINING_TYPES, fmtRupiah, isOpen, type HcRequest, type HcRequestKind } from "@/lib/hc-request";
import { FilePicker, RequestSummary, uploadAll } from "./request-shared";

type Tab = "open" | "done";

const COPY: Record<HcRequestKind, { new: string; title: string; sheetDesc: string; empty: string }> = {
  rekrutmen: {
    new: "Permintaan Baru",
    title: "Permintaan Karyawan",
    sheetDesc: "Diproses Human Capital. Jumlah yang benar-benar direkrut dihitung otomatis ke KPI Jumlah Rekrutmen.",
    empty: "Ajukan penambahan atau pengganti pegawai — Human Capital akan memprosesnya sampai kandidat diterima.",
  },
  pelatihan: {
    new: "Ajukan Pelatihan",
    title: "Pengajuan Pelatihan",
    sheetDesc: "Disetujui Human Capital, lalu Finance menyetujui dananya sebelum pelatihan dijalankan.",
    empty: "Ajukan program pelatihan untuk tim Anda — mulai dari ACC Human Capital hingga persetujuan dana Finance.",
  },
};

/** Daftar + formulir satu jenis pengajuan (satu halaman per kategori). */
export function HcRequestBoard({ kind }: { kind: HcRequestKind }) {
  const [rows, setRows] = React.useState<HcRequest[] | null>(null);
  const [tab, setTab] = React.useState<Tab>("open");
  const copy = COPY[kind];

  const load = React.useCallback(async () => {
    const all = await myHcRequestsAction();
    setRows(all.filter((r) => r.kind === kind));
  }, [kind]);
  React.useEffect(() => {
    void load();
  }, [load]);

  const open = (rows ?? []).filter((r) => isOpen(r.status));
  const done = (rows ?? []).filter((r) => !isOpen(r.status));
  const shown = tab === "open" ? open : done;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/50 p-1">
          {([
            { id: "open" as Tab, label: `Berjalan (${open.length})` },
            { id: "done" as Tab, label: `Riwayat (${done.length})` },
          ]).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={cn(
                "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.id ? "bg-background text-foreground shadow-md ring-1 ring-border" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <NewRequestSheet kind={kind} onDone={load} />
      </div>

      {rows === null ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Memuat pengajuan…
        </div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={Plus}
          title={tab === "open" ? "Belum ada pengajuan berjalan" : "Belum ada riwayat"}
          description={tab === "open" ? copy.empty : "Pengajuan yang sudah selesai atau ditolak muncul di sini."}
        />
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <RequestSummary key={r.id} r={r} timeline />
          ))}
        </div>
      )}
    </div>
  );
}

function NewRequestSheet({ kind, onDone }: { kind: HcRequestKind; onDone: () => void }) {
  const copy = COPY[kind];
  return (
    <Sheet>
      <SheetTrigger>
        <Button size="sm">
          <Plus className="size-4" /> {copy.new}
        </Button>
      </SheetTrigger>
      <SheetContent title={copy.title} description={copy.sheetDesc} className="max-w-lg">
        <RequestForm kind={kind} onDone={onDone} />
      </SheetContent>
    </Sheet>
  );
}

/** Judul kelompok isian di dalam formulir. */
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </section>
  );
}

/** Pesan galat di bawah satu isian. */
function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
      <AlertCircle className="size-3 shrink-0" /> {children}
    </p>
  );
}

type Errors = Partial<Record<"title" | "position" | "headcount" | "trainingType" | "participants", string>>;

function RequestForm({ kind, onDone }: { kind: HcRequestKind; onDone: () => void }) {
  const router = useRouter();
  const { setOpen } = useSheetControl();
  const isTraining = kind === "pelatihan";

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [position, setPosition] = React.useState("");
  const [headcount, setHeadcount] = React.useState("1");
  const [trainingType, setTrainingType] = React.useState(TRAINING_TYPES[0]);
  const [customType, setCustomType] = React.useState("");
  const [participants, setParticipants] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [plannedDate, setPlannedDate] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [errors, setErrors] = React.useState<Errors>({});
  const [busy, setBusy] = React.useState(false);

  const resolvedType = trainingType === "Lainnya" ? customType.trim() : trainingType;
  const budgetNum = Number(budget) || 0;

  function validate(): Errors {
    const e: Errors = {};
    if (!title.trim()) e.title = "Judul pengajuan wajib diisi.";
    if (isTraining) {
      if (!resolvedType) e.trainingType = "Sebutkan jenis pelatihannya.";
      if (Number(participants) < 1) e.participants = "Jumlah peserta minimal 1 orang.";
    } else {
      if (!position.trim()) e.position = "Posisi yang diminta wajib diisi.";
      if (Number(headcount) < 1) e.headcount = "Jumlah minimal 1 orang.";
    }
    return e;
  }

  async function submit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return toast.error("Lengkapi isian yang ditandai merah.");

    setBusy(true);
    try {
      const attachments = await uploadAll(files);
      const res = await submitHcRequestAction({
        kind,
        title: title.trim(),
        description: description.trim(),
        position: position.trim(),
        headcount: Number(headcount) || 0,
        trainingType: resolvedType,
        participants: Number(participants) || 0,
        budget: budgetNum,
        plannedDate,
        attachments,
      });
      if (res.error) return toast.error(res.error);
      toast.success("Pengajuan terkirim ke Human Capital");
      setOpen(false);
      onDone();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim pengajuan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-h-[76vh] space-y-5 overflow-y-auto p-5">
      <FormSection title="Informasi Pengajuan">
        <Field label="Judul Pengajuan">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={!!errors.title}
            className={cn(errors.title && "border-red-500/60")}
            placeholder={isTraining ? "cth. Pelatihan Service Excellence Batch 1" : "cth. Penambahan Barista Outlet Ketapang"}
          />
          <FieldError>{errors.title}</FieldError>
        </Field>
      </FormSection>

      {isTraining ? (
        <FormSection title="Detail Pelatihan">
          <Field label="Jenis Pelatihan">
            <SegmentedTabs
              value={trainingType === "Lainnya" ? "Lainnya" : "preset"}
              onChange={(v) => setTrainingType(v === "Lainnya" ? "Lainnya" : TRAINING_TYPES[0])}
              items={[
                { value: "preset", label: "Pilih dari daftar" },
                { value: "Lainnya", label: "Lainnya" },
              ]}
            />
            <div className="mt-2">
              {trainingType === "Lainnya" ? (
                <Input value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="Tulis jenis pelatihan…" />
              ) : (
                <Combobox
                  value={trainingType}
                  onChange={setTrainingType}
                  options={TRAINING_TYPES.filter((t) => t !== "Lainnya").map((t) => ({ value: t, label: t }))}
                  searchPlaceholder="Cari jenis…"
                />
              )}
            </div>
            <FieldError>{errors.trainingType}</FieldError>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jumlah Peserta">
              <Input
                type="number"
                min={1}
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                className={cn(errors.participants && "border-red-500/60")}
                placeholder="cth. 15"
              />
              <FieldError>{errors.participants}</FieldError>
            </Field>
            <Field label="Estimasi Biaya" hint={budgetNum > 0 ? fmtRupiah(budgetNum) : "Kosongkan bila tanpa biaya."}>
              <Input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="cth. 5000000" />
            </Field>
          </div>
          <Field label="Rencana Pelaksanaan">
            <DatePicker value={plannedDate} onChange={setPlannedDate} />
          </Field>
        </FormSection>
      ) : (
        <FormSection title="Kebutuhan Pegawai">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Posisi yang Diminta">
              <Input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className={cn(errors.position && "border-red-500/60")}
                placeholder="cth. Barista"
              />
              <FieldError>{errors.position}</FieldError>
            </Field>
            <Field label="Jumlah Orang">
              <Input
                type="number"
                min={1}
                value={headcount}
                onChange={(e) => setHeadcount(e.target.value)}
                className={cn(errors.headcount && "border-red-500/60")}
              />
              <FieldError>{errors.headcount}</FieldError>
            </Field>
          </div>
          <Field label="Target Mulai Kerja" hint="Dipakai HC untuk mengukur waktu rekrutmen.">
            <DatePicker value={plannedDate} onChange={setPlannedDate} />
          </Field>
        </FormSection>
      )}

      <FormSection title="Keterangan & Lampiran">
        <Field label={isTraining ? "Tujuan Pelatihan" : "Alasan Permintaan"}>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isTraining ? "Tujuan pelatihan, materi, narasumber…" : "Alasan penambahan, beban kerja saat ini…"}
          />
        </Field>
        <Field
          label={isTraining ? "Lampiran (proposal / materi / foto)" : "Lampiran (formulir permintaan pegawai)"}
          hint="PDF / JPG / PNG, maks 10 MB per berkas."
        >
          <FilePicker files={files} onChange={setFiles} disabled={busy} />
        </Field>
      </FormSection>

      <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {isTraining
          ? "Setelah dikirim: ACC Human Capital → persetujuan dana Finance → pelatihan dijalankan → HC menandai terlaksana."
          : "Setelah dikirim: ACC Human Capital → proses rekrutmen → HC menandai jumlah pegawai yang diterima."}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Kirim ke HC
        </Button>
      </div>
    </div>
  );
}
