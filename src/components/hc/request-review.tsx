"use client";

import * as React from "react";
import { CheckCircle2, ClipboardCheck, Loader2, UserRound, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  allHcRequestsAction,
  assignDesignRequestAction,
  completeHcRequestAction,
  financeDecideRequestAction,
  financeTrainingRequestsAction,
  hcDecideRequestAction,
} from "@/lib/actions/hc-requests";
import { Combobox } from "@/components/ui/combobox";
import {
  UPLOAD_HINT,
  fmtRupiah,
  nextActions,
  requestStage,
  stageFilters,
  type HcRequest,
  type HcRequestKind,
  type RequestStage,
} from "@/lib/hc-request";
import { StageFilterChips } from "@/components/ui/stage-filter";
import { DiscussButton } from "@/components/chat/forward-request";
import { FilePicker, RequestEmpty, RequestList, uploadAll, type UploadProgress } from "./request-shared";

type Mode = "hc" | "finance";

/** Kandidat PIC pengerjaan design (anggota tim Creative). */
export interface PicOption {
  id: string;
  name: string;
  jabatan?: string | null;
}

/** Antrian pengajuan — dipakai HC (per jenis) dan Finance (dana pelatihan). */
export function HcRequestReview({ mode, kind, picOptions = [] }: { mode: Mode; kind?: HcRequestKind; picOptions?: PicOption[] }) {
  const [rows, setRows] = React.useState<HcRequest[] | null>(null);
  const [stage, setStage] = React.useState<RequestStage | "all">("all");

  const load = React.useCallback(async () => {
    setRows(mode === "hc" ? await allHcRequestsAction(kind) : await financeTrainingRequestsAction());
  }, [mode, kind]);
  React.useEffect(() => {
    void load();
  }, [load]);

  // Antrian Finance hanya mengurus dana pelatihan; sisanya mengikuti jenis
  // yang sedang dibuka. Tanpa jenis (HC melihat semuanya sekaligus), pakai
  // saringan pelatihan yang tidak memuat tahap khusus design.
  const filterKind: HcRequestKind = mode === "finance" ? "pelatihan" : (kind ?? "pelatihan");
  const opsi = React.useMemo(() => stageFilters(filterKind), [filterKind]);

  const semua = rows ?? [];
  const tahapDari = React.useCallback(
    (r: HcRequest) => requestStage({ kind: r.kind, status: r.status, revisions: r.revisions }),
    [],
  );
  const shown = React.useMemo(
    () => (stage === "all" ? semua : semua.filter((r) => tahapDari(r) === stage)),
    [semua, stage, tahapDari],
  );
  const hitung = React.useCallback(
    (v: RequestStage | "all") => (v === "all" ? semua.length : semua.filter((r) => tahapDari(r) === v).length),
    [semua, tahapDari],
  );

  return (
    <div>
      <StageFilterChips className="mb-4" options={opsi} value={stage} onChange={setStage} count={hitung} />

      {rows === null ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Memuat…
        </div>
      ) : shown.length === 0 ? (
        <RequestEmpty>
          {stage === "all"
            ? mode === "hc"
              ? "Belum ada pengajuan yang masuk."
              : "Belum ada pengajuan pelatihan yang butuh persetujuan dana."
            : `Tidak ada pengajuan pada tahap "${opsi.find((o) => o.value === stage)?.label ?? stage}".`}
        </RequestEmpty>
      ) : (
        <RequestList
          rows={shown}
          actions={(r) => (
            <div className="flex flex-wrap items-center gap-2">
              {/* Peninjau sering perlu bertanya balik ke pemohon sebelum
                  memutuskan — dari sini langsung ke obrolan yang sudah membawa
                  pengajuannya. */}
              <DiscussButton requestId={r.id} requestTitle={r.title} suggestedIds={[r.requesterId]} label="Tanya" />
              <Actions r={r} mode={mode} picOptions={picOptions} onDone={load} />
            </div>
          )}
        />
      )}
    </div>
  );
}

function Actions({ r, mode, picOptions, onDone }: { r: HcRequest; mode: Mode; picOptions: PicOption[]; onDone: () => void }) {
  const step = nextActions(r);
  const [dialog, setDialog] = React.useState<null | "hc" | "finance" | "complete" | "assign">(null);
  const isDesign = r.kind === "design";

  if (mode === "hc") {
    return (
      <>
        {step.hc && (
          <>
            <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400" onClick={() => setDialog("hc")}>
              <XCircle className="size-4" /> Tinjau
            </Button>
            {/* Design tidak cukup di-ACC — harus jelas siapa yang mengerjakan,
                karena penugasan itulah yang membuat tugasnya di Work Tracker. */}
            {isDesign ? (
              <Button size="sm" onClick={() => setDialog("assign")}>
                <UserRound className="size-4" /> Tugaskan PIC
              </Button>
            ) : (
              <Button size="sm" onClick={() => setDialog("hc")}>
                <ClipboardCheck className="size-4" /> ACC
              </Button>
            )}
          </>
        )}
        {isDesign && !step.hc && r.status !== "terlaksana" && (
          <Button size="sm" variant="outline" onClick={() => setDialog("assign")}>
            <UserRound className="size-4" /> {r.assigneeName ? "Ganti PIC" : "Tugaskan PIC"}
          </Button>
        )}
        {step.complete && (
          <Button size="sm" onClick={() => setDialog("complete")}>
            <CheckCircle2 className="size-4" /> {isDesign ? "Tandai Selesai" : "Tandai Terlaksana"}
          </Button>
        )}
        {dialog === "hc" && <HcDecideDialog r={r} onClose={() => setDialog(null)} onDone={onDone} />}
        {dialog === "assign" && <AssignDialog r={r} picOptions={picOptions} onClose={() => setDialog(null)} onDone={onDone} />}
        {dialog === "complete" && <CompleteDialog r={r} onClose={() => setDialog(null)} onDone={onDone} />}
      </>
    );
  }

  return (
    <>
      {step.finance && (
        <Button size="sm" onClick={() => setDialog("finance")}>
          <Wallet className="size-4" /> Putuskan Dana
        </Button>
      )}
      {dialog === "finance" && <FinanceDecideDialog r={r} onClose={() => setDialog(null)} onDone={onDone} />}
    </>
  );
}

function HcDecideDialog({ r, onClose, onDone }: { r: HcRequest; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function decide(approve: boolean) {
    setBusy(true);
    const res = await hcDecideRequestAction({ id: r.id, approve, note });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(
      approve
        ? r.kind === "pelatihan"
          ? "Disetujui — diteruskan ke Finance"
          : r.kind === "design"
            ? "Disetujui — design masuk antrian pengerjaan"
            : "Permintaan pegawai disetujui"
        : "Pengajuan ditolak",
    );
    onClose();
    onDone();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Tinjau Pengajuan" description={r.title} align="center" className="max-w-md">
        <div className="space-y-3 p-5">
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {r.kind === "pelatihan"
              ? "Disetujui → diteruskan ke Finance untuk persetujuan dana."
              : r.kind === "design"
                ? "Disetujui → design masuk antrian pengerjaan tim Creative. Setelah jadi, tandai Selesai dan lampirkan hasilnya."
                : "Disetujui → permintaan masuk proses rekrutmen. Setelah pegawai diterima, tandai Terlaksana dan isi jumlah yang direkrut."}
          </p>
          <Field label="Catatan (opsional)">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alasan / arahan…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
            <Button variant="outline" className="text-red-600 dark:text-red-400" onClick={() => decide(false)} disabled={busy}>
              <XCircle className="size-4" /> Tolak
            </Button>
            <Button onClick={() => decide(true)} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Setujui
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FinanceDecideDialog({ r, onClose, onDone }: { r: HcRequest; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = React.useState(String(r.budget || 0));
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function decide(approve: boolean) {
    setBusy(true);
    const res = await financeDecideRequestAction({ id: r.id, approve, budgetApproved: Number(amount) || 0, note });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(approve ? "Dana disetujui" : "Pengajuan dana ditolak");
    onClose();
    onDone();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Persetujuan Dana Pelatihan" description={r.title} align="center" className="max-w-md">
        <div className="space-y-3 p-5">
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Diajukan {r.department} · {r.participants} peserta · estimasi <span className="font-medium text-foreground">{fmtRupiah(r.budget)}</span>
            {r.hcNote && <p className="mt-1">Catatan HC: {r.hcNote}</p>}
          </div>
          <Field label="Dana Disetujui (Rp)">
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Catatan (opsional)">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sumber anggaran, termin pencairan…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
            <Button variant="outline" className="text-red-600 dark:text-red-400" onClick={() => decide(false)} disabled={busy}>
              <XCircle className="size-4" /> Tolak
            </Button>
            <Button onClick={() => decide(true)} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />} Setujui Dana
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompleteDialog({ r, onClose, onDone }: { r: HcRequest; onClose: () => void; onDone: () => void }) {
  const isRecruit = r.kind === "rekrutmen";
  const isDesign = r.kind === "design";
  const [recruited, setRecruited] = React.useState(String(r.headcount || 0));
  const [note, setNote] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<UploadProgress | null>(null);

  async function submit() {
    setBusy(true);
    setProgress(null);
    try {
      const attachments = await uploadAll(files, setProgress);
      const res = await completeHcRequestAction({
        id: r.id,
        recruited: isRecruit ? Number(recruited) || 0 : undefined,
        note,
        attachments,
      });
      if (res.error) return toast.error(res.error);
      toast.success(isDesign ? "Design ditandai selesai" : "Ditandai terlaksana");
      onClose();
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Tandai Terlaksana" description={r.title} align="center" className="max-w-md">
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
          <p className="rounded-lg bg-brand-500/10 px-3 py-2 text-xs text-muted-foreground">
            {isRecruit
              ? "Isi jumlah pegawai yang benar-benar direkrut dari permintaan ini."
              : isDesign
                ? "Lampirkan hasil designnya agar pemohon bisa langsung mengunduh dari halaman pengajuannya."
                : "Tandai bahwa program pelatihannya sudah benar-benar dijalankan."}
          </p>
          {isRecruit && (
            <Field label={`Jumlah Direkrut (dari ${r.headcount} diminta)`}>
              <Input type="number" min={0} value={recruited} onChange={(e) => setRecruited(e.target.value)} />
            </Field>
          )}
          <Field
            label={isRecruit ? "Bukti (offering letter / SK)" : isDesign ? "Hasil design (JPG / PNG / PDF)" : "Bukti (laporan, daftar hadir, foto kegiatan)"}
            hint={UPLOAD_HINT}
          >
            <FilePicker files={files} onChange={setFiles} disabled={busy} label={isDesign ? "Unggah hasil design" : "Unggah bukti"} />
          </Field>
          <Field label="Catatan (opsional)">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>

          {/* Kemajuan nyata per byte — berkas design bisa beberapa MB dan tanpa
              ini layarnya tampak menggantung belasan detik. */}
          {progress && (
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                <span className="min-w-0 truncate text-foreground/80">
                  Mengunggah {progress.index}/{progress.total} · {progress.fileName}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {Math.round(progress.ratio * 100)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-150"
                  style={{ width: `${Math.round(progress.ratio * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Menugaskan PIC untuk satu permintaan design. Ini bukan sekadar mencatat nama:
 * begitu disimpan, sistem membuat tugasnya di Work Tracker atas nama PIC
 * tersebut, sehingga beban kerja tim Creative terlihat di satu tempat.
 */
function AssignDialog({
  r,
  picOptions,
  onClose,
  onDone,
}: {
  r: HcRequest;
  picOptions: PicOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [pic, setPic] = React.useState(r.assigneeId ?? "");
  const [busy, setBusy] = React.useState(false);

  async function save() {
    if (!pic) return toast.error("Pilih PIC yang mengerjakan.");
    setBusy(true);
    const res = await assignDesignRequestAction({ id: r.id, assigneeId: pic });
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    const name = picOptions.find((p) => p.id === pic)?.name ?? "PIC";
    toast.success(`Dikerjakan oleh ${name} — tugasnya masuk Work Tracker Creative`);
    onClose();
    onDone();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        align="center"
        title={r.assigneeName ? "Ganti PIC Pengerjaan" : "Tugaskan PIC Pengerjaan"}
        description={r.title}
        className="max-w-md"
      >
        <div className="space-y-4 p-5">
          {picOptions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              Belum ada anggota tim Creative di User Management.
            </p>
          ) : (
            <Field label="Dikerjakan oleh">
              <Combobox
                portal
                matchTriggerWidth
                searchable
                searchPlaceholder="Cari nama…"
                value={pic}
                onChange={setPic}
                options={picOptions.map((p) => ({ value: p.id, label: p.name, hint: p.jabatan ?? undefined }))}
                placeholder="Pilih PIC"
              />
            </Field>
          )}

          <p className="rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
            Setelah ditugaskan, tugas otomatis muncul di <b className="text-foreground">Work Tracker Creative</b> atas nama
            PIC. Menandai tugas itu selesai akan menutup permintaan design ini, begitu pula sebaliknya.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Batal
            </Button>
            <Button onClick={save} disabled={busy || picOptions.length === 0}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <UserRound className="size-4" />} Simpan
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
