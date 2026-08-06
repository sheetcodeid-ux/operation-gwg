"use client";

import * as React from "react";
import { CheckCircle2, ClipboardCheck, Loader2, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  allHcRequestsAction,
  completeHcRequestAction,
  financeDecideRequestAction,
  financeTrainingRequestsAction,
  hcDecideRequestAction,
} from "@/lib/actions/hc-requests";
import { fmtRupiah, isOpen, nextActions, type HcRequest, type HcRequestKind } from "@/lib/hc-request";
import { FilePicker, RequestEmpty, RequestList, uploadAll } from "./request-shared";

type Mode = "hc" | "finance";
type Tab = "open" | "done";

/** Antrian pengajuan — dipakai HC (per jenis) dan Finance (dana pelatihan). */
export function HcRequestReview({ mode, kind }: { mode: Mode; kind?: HcRequestKind }) {
  const [rows, setRows] = React.useState<HcRequest[] | null>(null);
  const [tab, setTab] = React.useState<Tab>("open");

  const load = React.useCallback(async () => {
    setRows(mode === "hc" ? await allHcRequestsAction(kind) : await financeTrainingRequestsAction());
  }, [mode, kind]);
  React.useEffect(() => {
    void load();
  }, [load]);

  const open = (rows ?? []).filter((r) => isOpen(r.status));
  const done = (rows ?? []).filter((r) => !isOpen(r.status));
  const shown = tab === "open" ? open : done;

  return (
    <div>
      <div className="mb-4 inline-grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/50 p-1">
        {([
          { id: "open" as Tab, label: `Antrian (${open.length})` },
          { id: "done" as Tab, label: `Selesai (${done.length})` },
        ]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id ? "bg-background text-foreground shadow-md ring-1 ring-border" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Memuat…
        </div>
      ) : shown.length === 0 ? (
        <RequestEmpty>
          {tab === "open"
            ? mode === "hc"
              ? "Tidak ada antrian — semua pengajuan departemen sudah diproses."
              : "Tidak ada pengajuan pelatihan yang menunggu persetujuan dana."
            : "Pengajuan yang sudah selesai akan muncul di sini."}
        </RequestEmpty>
      ) : (
        <RequestList rows={shown} actions={(r) => <Actions r={r} mode={mode} onDone={load} />} />
      )}
    </div>
  );
}

function Actions({ r, mode, onDone }: { r: HcRequest; mode: Mode; onDone: () => void }) {
  const step = nextActions(r);
  const [dialog, setDialog] = React.useState<null | "hc" | "finance" | "complete">(null);

  if (mode === "hc") {
    return (
      <>
        {step.hc && (
          <>
            <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400" onClick={() => setDialog("hc")}>
              <XCircle className="size-4" /> Tinjau
            </Button>
            <Button size="sm" onClick={() => setDialog("hc")}>
              <ClipboardCheck className="size-4" /> ACC
            </Button>
          </>
        )}
        {step.complete && (
          <Button size="sm" onClick={() => setDialog("complete")}>
            <CheckCircle2 className="size-4" /> {r.kind === "design" ? "Tandai Selesai" : "Tandai Terlaksana"}
          </Button>
        )}
        {dialog === "hc" && <HcDecideDialog r={r} onClose={() => setDialog(null)} onDone={onDone} />}
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

  async function submit() {
    setBusy(true);
    try {
      const attachments = await uploadAll(files);
      const res = await completeHcRequestAction({
        id: r.id,
        recruited: isRecruit ? Number(recruited) || 0 : undefined,
        note,
        attachments,
      });
      if (res.error) return toast.error(res.error);
      toast.success(isDesign ? "Design ditandai selesai" : "Ditandai terlaksana — masuk ke KPI Human Capital");
      onClose();
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Tandai Terlaksana" description={r.title} align="center" className="max-w-md">
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
          <p className="rounded-lg bg-brand-500/10 px-3 py-2 text-xs text-muted-foreground">
            {isRecruit
              ? "Jumlah yang direkrut dihitung otomatis sebagai realisasi KPI Jumlah Rekrutmen bulan ini."
              : isDesign
                ? "Lampirkan hasil designnya agar pemohon bisa langsung mengunduh dari halaman pengajuannya."
                : "Program yang terlaksana dihitung otomatis sebagai realisasi KPI Development / Pelatihan bulan ini."}
          </p>
          {isRecruit && (
            <Field label={`Jumlah Direkrut (dari ${r.headcount} diminta)`}>
              <Input type="number" min={0} value={recruited} onChange={(e) => setRecruited(e.target.value)} />
            </Field>
          )}
          <Field
            label={isRecruit ? "Bukti (offering letter / SK)" : isDesign ? "Hasil design (JPG / PNG / PDF)" : "Bukti (laporan, daftar hadir, foto kegiatan)"}
            hint="PDF / JPG / PNG, maks 10 MB per berkas."
          >
            <FilePicker files={files} onChange={setFiles} disabled={busy} label={isDesign ? "Unggah hasil design" : "Unggah bukti"} />
          </Field>
          <Field label="Catatan (opsional)">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
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
