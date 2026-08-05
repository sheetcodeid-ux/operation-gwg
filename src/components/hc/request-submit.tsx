"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Textarea } from "@/components/ui/input";
import { MultiCombobox } from "@/components/ui/multi-combobox";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Dialog, DialogContent, DialogTrigger, useDialogControl } from "@/components/ui/dialog";
import { submitHcRequestAction } from "@/lib/actions/hc-requests";
import { TRAINING_TYPES, fmtRupiah, type HcRequest, type HcRequestKind } from "@/lib/hc-request";
import { FilePicker, RequestEmpty, RequestList, uploadAll } from "./request-shared";

const COPY: Record<HcRequestKind, { new: string; title: string; formDesc: string; empty: string }> = {
  rekrutmen: {
    new: "Permintaan Baru",
    title: "Permintaan Karyawan",
    formDesc: "Diproses Human Capital. Jumlah yang benar-benar direkrut dihitung otomatis ke KPI Jumlah Rekrutmen.",
    empty: "Belum ada permintaan. Klik “Permintaan Baru” untuk mengirim permintaan pegawai ke Human Capital.",
  },
  pelatihan: {
    new: "Ajukan Pelatihan",
    title: "Pengajuan Pelatihan",
    formDesc: "Disetujui Human Capital, lalu Finance menyetujui dananya sebelum pelatihan dijalankan.",
    empty: "Belum ada pengajuan. Klik “Ajukan Pelatihan” untuk mengirim program pelatihan ke Human Capital.",
  },
};

/** Anggota departemen pemohon — kandidat peserta pelatihan. */
export interface DeptMember {
  id: string;
  name: string;
  jabatan?: string | null;
}

/** Daftar pengajuan milik departemen, dirender dari data halaman. */
export function HcRequestList({ rows, kind }: { rows: HcRequest[]; kind: HcRequestKind }) {
  if (rows.length === 0) return <RequestEmpty>{COPY[kind].empty}</RequestEmpty>;
  return <RequestList rows={rows} />;
}

/** Dialog terpusat — bentuk yang sama dengan Pengajuan Dokumen & Pengajuan
 *  System, supaya seluruh formulir pengajuan terasa satu keluarga. */
export function NewRequestButton({ kind, members = [] }: { kind: HcRequestKind; members?: DeptMember[] }) {
  const copy = COPY[kind];
  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm">
          <Plus /> {copy.new}
        </Button>
      </DialogTrigger>
      <DialogContent title={copy.title} description={copy.formDesc} align="center" className="max-w-lg">
        <RequestForm kind={kind} members={members} />
      </DialogContent>
    </Dialog>
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

function RequestForm({ kind, members }: { kind: HcRequestKind; members: DeptMember[] }) {
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const isTraining = kind === "pelatihan";

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [position, setPosition] = React.useState("");
  const [headcount, setHeadcount] = React.useState("1");
  const [trainingType, setTrainingType] = React.useState(TRAINING_TYPES[0]);
  const [customType, setCustomType] = React.useState("");
  const [participantIds, setParticipantIds] = React.useState<string[]>([]);
  const [participants, setParticipants] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [plannedDate, setPlannedDate] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [errors, setErrors] = React.useState<Errors>({});
  const [busy, setBusy] = React.useState(false);

  const resolvedType = trainingType === "Lainnya" ? customType.trim() : trainingType;
  const budgetNum = Number(budget) || 0;

  // Peserta boleh dipilih dari anggota departemen; bila tidak ada yang dipilih
  // (mis. pelatihan untuk kandidat baru), jumlahnya diisi manual.
  const participantNames = React.useMemo(() => {
    const byId = new Map(members.map((m) => [m.id, m.name]));
    return participantIds.map((id) => byId.get(id)).filter((n): n is string => !!n);
  }, [members, participantIds]);
  const participantCount = participantNames.length > 0 ? participantNames.length : Number(participants) || 0;

  function validate(): Errors {
    const e: Errors = {};
    if (!title.trim()) e.title = "Judul pengajuan wajib diisi.";
    if (isTraining) {
      if (!resolvedType) e.trainingType = "Sebutkan jenis pelatihannya.";
      if (participantCount < 1) e.participants = "Pilih pesertanya atau isi jumlah peserta.";
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
        participants: participantCount,
        participantNames,
        budget: budgetNum,
        plannedDate,
        attachments,
      });
      if (res.error) return toast.error(res.error);
      toast.success("Pengajuan terkirim ke Human Capital");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengirim pengajuan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-h-[76vh] space-y-3 overflow-y-auto p-5">
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

      {isTraining ? (
        <>
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
          <Field
            label="Peserta"
            hint={
              members.length > 0
                ? "Pilih dari anggota departemen Anda. Kosongkan bila peserta di luar daftar, lalu isi jumlahnya."
                : "Belum ada anggota terdaftar di departemen ini — isi jumlah pesertanya saja."
            }
          >
            {members.length > 0 && (
              <MultiCombobox
                value={participantIds}
                onChange={setParticipantIds}
                options={members.map((m) => ({ value: m.id, label: m.name, hint: m.jabatan ?? undefined }))}
                placeholder="Pilih peserta…"
                searchPlaceholder="Cari nama…"
                allLabel="Semua anggota"
              />
            )}
            {participantNames.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {participantNames.map((n) => (
                  <span key={n} className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] text-foreground/85">{n}</span>
                ))}
              </div>
            )}
            <FieldError>{errors.participants}</FieldError>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Jumlah Peserta"
              hint={participantNames.length > 0 ? "Terisi otomatis dari peserta yang dipilih." : undefined}
            >
              <Input
                type="number"
                min={1}
                value={participantNames.length > 0 ? String(participantNames.length) : participants}
                readOnly={participantNames.length > 0}
                onChange={(e) => setParticipants(e.target.value)}
                className={cn(errors.participants && "border-red-500/60", participantNames.length > 0 && "bg-muted/50")}
                placeholder="cth. 15"
              />
            </Field>
            <Field label="Estimasi Biaya" hint={budgetNum > 0 ? fmtRupiah(budgetNum) : "Kosongkan bila tanpa biaya."}>
              <Input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="cth. 5000000" />
            </Field>
          </div>
          <Field label="Rencana Pelaksanaan">
            <DatePicker value={plannedDate} onChange={setPlannedDate} />
          </Field>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
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
        </>
      )}

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

      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {isTraining
          ? "Setelah dikirim: ACC Human Capital → persetujuan dana Finance → pelatihan dijalankan → HC menandai terlaksana."
          : "Setelah dikirim: ACC Human Capital → proses rekrutmen → HC menandai jumlah pegawai yang diterima."}
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
        <Button onClick={submit} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Kirim Pengajuan
        </Button>
      </div>
    </div>
  );
}
