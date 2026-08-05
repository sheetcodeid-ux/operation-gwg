"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Textarea } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Sheet, SheetContent, SheetTrigger, useSheetControl } from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/page-header";
import { myHcRequestsAction, submitHcRequestAction } from "@/lib/actions/hc-requests";
import { TRAINING_TYPES, type HcRequest, type HcRequestKind } from "@/lib/hc-request";
import { FilePicker, RequestSummary, uploadAll } from "./request-shared";

/** Halaman "Pengajuan ke HC" — tersedia untuk SEMUA departemen. */
export function HcRequestBoard() {
  const [rows, setRows] = React.useState<HcRequest[] | null>(null);

  const load = React.useCallback(async () => {
    setRows(await myHcRequestsAction());
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <NewRequestSheet kind="rekrutmen" onDone={load} />
        <NewRequestSheet kind="pelatihan" onDone={load} />
      </div>

      {rows === null ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Memuat pengajuan…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada pengajuan"
          description="Ajukan permintaan pegawai atau program pelatihan — Human Capital akan memprosesnya."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <RequestSummary key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewRequestSheet({ kind, onDone }: { kind: HcRequestKind; onDone: () => void }) {
  const isTraining = kind === "pelatihan";
  return (
    <Sheet>
      <SheetTrigger>
        <Button size="sm" variant={isTraining ? "outline" : "default"}>
          <Plus className="size-4" /> {isTraining ? "Ajukan Pelatihan" : "Minta Pegawai"}
        </Button>
      </SheetTrigger>
      <SheetContent
        title={isTraining ? "Pengajuan Pelatihan" : "Permintaan Pegawai"}
        description={
          isTraining
            ? "Diproses Human Capital, lalu Finance menyetujui dananya sebelum pelatihan dijalankan."
            : "Diproses Human Capital. Realisasi rekrutmen dihitung otomatis ke KPI Jumlah Rekrutmen."
        }
        className="max-w-lg"
      >
        <RequestForm kind={kind} onDone={onDone} />
      </SheetContent>
    </Sheet>
  );
}

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
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!title.trim()) return toast.error("Judul pengajuan wajib diisi.");
    if (!isTraining && (!position.trim() || Number(headcount) < 1)) {
      return toast.error("Posisi dan jumlah pegawai wajib diisi.");
    }
    const type = trainingType === "Lainnya" ? customType.trim() : trainingType;
    if (isTraining && !type) return toast.error("Sebutkan jenis pelatihannya.");

    setBusy(true);
    try {
      const attachments = await uploadAll(files);
      const res = await submitHcRequestAction({
        kind,
        title: title.trim(),
        description: description.trim(),
        position: position.trim(),
        headcount: Number(headcount) || 0,
        trainingType: type,
        participants: Number(participants) || 0,
        budget: Number(budget) || 0,
        plannedDate,
        attachments,
      });
      if (res.error) return toast.error(res.error);
      toast.success("Pengajuan terkirim ke Human Capital");
      setOpen(false);
      onDone();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim pengajuan.");
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
          placeholder={isTraining ? "cth. Pelatihan Service Excellence Batch 1" : "cth. Penambahan Barista Outlet Ketapang"}
        />
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
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jumlah Peserta">
              <Input type="number" min={0} value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="cth. 15" />
            </Field>
            <Field label="Estimasi Biaya (Rp)">
              <Input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="cth. 5000000" />
            </Field>
          </div>
          <Field label="Rencana Pelaksanaan">
            <DatePicker value={plannedDate} onChange={setPlannedDate} />
          </Field>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Posisi yang Diminta">
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="cth. Barista" />
          </Field>
          <Field label="Jumlah Orang">
            <Input type="number" min={1} value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
          </Field>
        </div>
      )}

      <Field label="Keterangan / Alasan">
        <Textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={isTraining ? "Tujuan pelatihan, materi, narasumber…" : "Alasan penambahan, target mulai kerja…"}
        />
      </Field>

      <Field
        label={isTraining ? "Lampiran (proposal / materi / foto)" : "Lampiran (formulir permintaan pegawai)"}
        hint="PDF / JPG / PNG, maks 10 MB per berkas."
      >
        <FilePicker files={files} onChange={setFiles} disabled={busy} />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Kirim ke HC
        </Button>
      </div>
    </div>
  );
}
