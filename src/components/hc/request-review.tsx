"use client";

import * as React from "react";
import { CheckCircle2, CircleDashed, ClipboardCheck, Loader2, SendHorizonal, ShieldCheck, Undo2, UserRound, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import {
  accDesignResultAction,
  allHcRequestsAction,
  assignDesignRequestAction,
  completeHcRequestAction,
  financeDecideRequestAction,
  financeTrainingRequestsAction,
  hcDecideRequestAction,
  submitDesignResultAction,
} from "@/lib/actions/hc-requests";
import { Combobox } from "@/components/ui/combobox";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import {
  BilahModul,
  KerangkaModul,
  useLayarPenuh,
} from "@/components/hcmos/kit-modul";
import { NAV_ICONS } from "@/components/layout/icons";
import {
  LABEL_SCOPE_MANPOWER,
  SCOPE_MANPOWER,
  UPLOAD_HINT,
  fmtRupiah,
  nextActions,
  requestStage,
  stageFilters,
  type HcRequest,
  type HcRequestKind,
  type RequestStage,
  type ScopeManpower,
} from "@/lib/hc-request";
import { StageFilterChips } from "@/components/ui/stage-filter";
import { DiscussButton } from "@/components/chat/forward-request";
import { FileChip, FilePicker, RequestEmpty, RequestList, uploadAll, type UploadProgress } from "./request-shared";

type Mode = "hc" | "finance";

/** Kandidat PIC pengerjaan design (anggota tim Creative). */
export interface PicOption {
  id: string;
  name: string;
  jabatan?: string | null;
}

/**
 * Antrian pengajuan — dipakai HC (per jenis) dan Finance (dana pelatihan).
 *
 * `kelola` membedakan dua peran yang membuka layar yang sama: yang MENGERJAKAN
 * (designer) hanya menerima kolam bersama + pekerjaannya sendiri — server sudah
 * memotongnya sebelum sampai ke sini — sementara yang MENGELOLA menerima
 * seluruh antrian dan butuh saringan per PIC untuk membaginya.
 */
export function HcRequestReview({
  mode,
  kind,
  picOptions = [],
  kelola = false,
  meId,
  bingkai: kepala,
}: {
  mode: Mode;
  kind?: HcRequestKind;
  picOptions?: PicOption[];
  kelola?: boolean;
  meId?: string;
  /**
   * Bila diisi, antreannya dibungkus bingkai modul HC-MOS: batang alat berisi
   * identitas modul, pencarian, panduan, dan layar penuh.
   *
   * Dibuat opsional dengan sengaja. Komponen ini juga dipakai Antrian System
   * dan Antrian Design di luar Human Capital; memaksakan bingkainya ke semua
   * pemakai berarti mengubah dua modul yang tidak sedang diminta berubah.
   */
  bingkai?: { judul: string; ikon: string; gradien?: string; panduan: string };
}) {
  const [rows, setRows] = React.useState<HcRequest[] | null>(null);
  const [stage, setStage] = React.useState<RequestStage | "all">("all");
  const [cari, setCari] = React.useState("");
  const { bingkai: refBingkai, layarPenuh, alih } = useLayarPenuh();
  const [pic, setPic] = React.useState("all");
  const [scope, setScope] = React.useState<ScopeManpower | "all">("all");

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

  const saringPic = kind === "design" && kelola;
  const opsiPic = React.useMemo(
    () => [
      { value: "all", label: "Semua PIC" },
      { value: "belum", label: "Belum ditugaskan" },
      ...picOptions.map((p) => ({ value: p.id, label: p.name })),
    ],
    [picOptions],
  );

  // Saringan PIC diterapkan LEBIH DULU, supaya angka di tiap tahap ikut
  // menyesuaikan. Kalau tidak, "Sedang Dikerjakan (7)" akan tetap tertulis 7
  // padahal yang tampil setelah memilih satu nama hanya dua.
  // Permintaan karyawan dipisah Manajemen / Outlet — keduanya ditangani orang
  // yang berbeda dan diukur dengan cara yang berbeda, jadi dicampur dalam satu
  // daftar keduanya sama-sama sulit dibaca.
  const saringScope = kind === "rekrutmen";

  const semua = React.useMemo(() => {
    let list = rows ?? [];
    if (saringScope && scope !== "all") list = list.filter((r) => r.scope === scope);
    if (!saringPic || pic === "all") return list;
    return pic === "belum" ? list.filter((r) => !r.assigneeId) : list.filter((r) => r.assigneeId === pic);
  }, [rows, saringPic, pic, saringScope, scope]);

  const tahapDari = React.useCallback(
    (r: HcRequest) => requestStage({ kind: r.kind, status: r.status, revisions: r.revisions }),
    [],
  );
  /**
   * Pencarian nama pemohon dan judul pengajuan.
   *
   * Antrean ini sebelumnya hanya bisa disaring per tahap. Mencari satu
   * pengajuan tertentu berarti menebak tahapnya lebih dulu — dan kalau salah
   * tebak, kesimpulannya jadi "pengajuannya hilang".
   */
  const q = cari.trim().toLowerCase();
  const shown = React.useMemo(() => {
    const perTahap = stage === "all" ? semua : semua.filter((r) => tahapDari(r) === stage);
    if (!q) return perTahap;
    return perTahap.filter((r) =>
      `${r.title ?? ""} ${r.requesterName ?? ""} ${r.department ?? ""}`.toLowerCase().includes(q),
    );
  }, [semua, stage, tahapDari, q]);
  const hitung = React.useCallback(
    (v: RequestStage | "all") => (v === "all" ? semua.length : semua.filter((r) => tahapDari(r) === v).length),
    [semua, tahapDari],
  );

  const isi = (
    <>
      {saringScope && (
        <SegmentedTabs
          className="mb-3 max-w-lg"
          size="sm"
          value={scope}
          onChange={(v) => setScope(v as ScopeManpower | "all")}
          items={[
            { value: "all", label: `Semua (${(rows ?? []).length})` },
            ...SCOPE_MANPOWER.map((v) => ({
              value: v,
              label: `${LABEL_SCOPE_MANPOWER[v]} (${(rows ?? []).filter((r) => r.scope === v).length})`,
            })),
          ]}
        />
      )}
      {saringPic && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Tampilkan pekerjaan</span>
          <Combobox value={pic} onChange={setPic} options={opsiPic} className="w-full sm:w-56" />
        </div>
      )}
      {kind === "design" && !kelola && (
        <p className="mb-3 rounded-xl border border-border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          <b className="text-foreground">Menunggu</b> berisi permintaan baru seluruh tim Creative — siapa pun boleh
          mengambilnya. Tab lainnya (Sedang Dikerjakan, Revisi, Menunggu ACC, Selesai, Ditolak) hanya berisi{" "}
          <b className="text-foreground">pekerjaan Anda sendiri</b>, jadi tidak tercampur dengan pekerjaan rekan.
          Setelah <b className="text-foreground">Kirim Hasil</b>, berkasnya menunggu ACC atasan dulu — pemohon belum
          menerima apa pun sampai itu selesai.
        </p>
      )}
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
              <Actions r={r} mode={mode} picOptions={picOptions} kelola={kelola} meId={meId} onDone={load} />
            </div>
          )}
        />
      )}
    </>
  );

  // Tanpa `bingkai`, tampilannya persis seperti sebelumnya — itu yang dilihat
  // Antrian System dan Antrian Design.
  if (!kepala) return <div>{isi}</div>;

  return (
    <KerangkaModul ref={refBingkai}>
      <BilahModul
        ikon={NAV_ICONS[kepala.ikon] ?? CircleDashed}
        gradien={kepala.gradien}
        judul={kepala.judul}
        ringkas={
          rows === null
            ? "Memuat…"
            : `${semua.length} pengajuan${stage !== "all" ? ` · saringan tahap aktif` : ""}`
        }
        cari={cari}
        onCari={setCari}
        cariPlaceholder="Cari judul, pemohon, departemen…"
        hitung={{ tampil: shown.length, total: semua.length }}
        menyaring={q !== "" || stage !== "all"}
        onBersihkan={() => {
          setCari("");
          setStage("all");
        }}
        panduan={kepala.panduan}
        layarPenuh={layarPenuh}
        onLayarPenuh={alih}
      />
      <div className="min-h-0 flex-1 overflow-auto p-3">{isi}</div>
    </KerangkaModul>
  );
}

function Actions({
  r,
  mode,
  picOptions,
  kelola,
  meId,
  onDone,
}: {
  r: HcRequest;
  mode: Mode;
  picOptions: PicOption[];
  kelola: boolean;
  meId?: string;
  onDone: () => void;
}) {
  const step = nextActions(r);
  const [dialog, setDialog] = React.useState<null | "hc" | "finance" | "complete" | "assign" | "kirim" | "acc">(null);
  const isDesign = r.kind === "design";

  if (mode === "hc") {
    return (
      <>
        {step.hc && (
          <>
            <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400" onClick={() => setDialog("hc")}>
              <XCircle className="size-4" /> {isDesign ? "Tolak" : "Tinjau"}
            </Button>
            {/* Design tidak cukup di-ACC — harus jelas siapa yang mengerjakan,
                karena penugasan itulah yang membuat tugasnya di Work Tracker. */}
            {isDesign ? (
              <Button size="sm" onClick={() => setDialog("assign")}>
                <UserRound className="size-4" /> {kelola ? "Tugaskan PIC" : "Ambil Pekerjaan"}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setDialog("hc")}>
                <ClipboardCheck className="size-4" /> ACC
              </Button>
            )}
          </>
        )}
        {/* Penugasan adalah pintu masuk pekerjaan, dan pintunya cuma satu: tahap
            Menunggu. Mengulanginya di "Sedang Dikerjakan" membuat tombol yang
            sama muncul dua kali untuk satu keputusan yang sudah diambil.

            Yang tersisa di sini bukan pengulangan itu, melainkan tindakan yang
            berbeda: MEMINDAHKAN pekerjaan yang sudah berjalan ke orang lain —
            keputusan pembagian beban, bukan keputusan pengerjaan. Tanpa jalan
            ini, satu designer yang berhalangan berarti pekerjaannya tidak
            pernah bisa dilanjutkan siapa pun. */}
        {isDesign && !step.hc && r.status !== "terlaksana" && r.status !== "menunggu_atasan" && kelola && (
          <Button size="sm" variant="outline" onClick={() => setDialog("assign")}>
            <UserRound className="size-4" /> {r.assigneeName ? "Ganti PIC" : "Tugaskan PIC"}
          </Button>
        )}
        {/* Design tidak lagi "ditandai selesai" oleh yang mengerjakannya. Ia
            MENYERAHKAN hasilnya; yang menutupnya adalah atasan di langkah
            berikutnya. Dua tombol berbeda karena memang dua keputusan berbeda,
            dan dulu keduanya tertumpuk jadi satu. */}
        {step.complete && (
          <Button size="sm" onClick={() => setDialog(isDesign ? "kirim" : "complete")}>
            {isDesign ? <SendHorizonal className="size-4" /> : <CheckCircle2 className="size-4" />}{" "}
            {isDesign ? "Kirim Hasil" : "Tandai Terlaksana"}
          </Button>
        )}
        {/* Menunggu ACC. Yang mengerjakan tetap melihat barisnya — supaya ia
            tahu hasilnya sudah masuk dan sedang di tangan siapa — tapi tombolnya
            hanya muncul untuk yang berhak memutuskan. */}
        {step.accAtasan &&
          (kelola ? (
            <Button size="sm" onClick={() => setDialog("acc")}>
              <ShieldCheck className="size-4" /> Periksa Hasil
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground">Menunggu ACC atasan</span>
          ))}
        {dialog === "hc" && <HcDecideDialog r={r} onClose={() => setDialog(null)} onDone={onDone} />}
        {dialog === "assign" && (
          <AssignDialog r={r} picOptions={picOptions} kelola={kelola} meId={meId} onClose={() => setDialog(null)} onDone={onDone} />
        )}
        {dialog === "complete" && <CompleteDialog r={r} onClose={() => setDialog(null)} onDone={onDone} />}
        {dialog === "kirim" && <KirimHasilDialog r={r} onClose={() => setDialog(null)} onDone={onDone} />}
        {dialog === "acc" && <AccHasilDialog r={r} onClose={() => setDialog(null)} onDone={onDone} />}
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

/**
 * Meninjau pengajuan.
 *
 * Design tidak punya tombol "Setujui" di sini, dan itu disengaja. Menyetujui
 * design TANPA menunjuk siapa yang mengerjakan menghasilkan baris yang berstatus
 * "Sedang Dikerjakan" padahal tidak ada yang mengerjakan: ia lolos dari tab
 * Menunggu, tapi tidak masuk daftar siapa pun, jadi tidak ada yang merasa itu
 * bagiannya sampai pemohonnya menagih. Persetujuan design terjadi lewat
 * penugasan — satu langkah, bukan dua yang boleh berjalan sendiri-sendiri.
 */
function HcDecideDialog({ r, onClose, onDone }: { r: HcRequest; onClose: () => void; onDone: () => void }) {
  const isDesign = r.kind === "design";
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
      <DialogContent title={isDesign ? "Tolak Permintaan Design" : "Tinjau Pengajuan"} description={r.title} align="center" className="max-w-md">
        <div className="space-y-3 p-5">
          <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {r.kind === "pelatihan"
              ? "Disetujui → diteruskan ke Finance untuk persetujuan dana."
              : isDesign
                ? "Untuk menerima permintaan ini, pakai tombol penugasan PIC — design dianggap disetujui begitu ada yang mengerjakannya. Di sini hanya untuk menolak."
                : "Disetujui → permintaan masuk proses rekrutmen. Setelah pegawai diterima, tandai Terlaksana dan isi jumlah yang direkrut."}
          </p>
          <Field label={isDesign ? "Alasan penolakan" : "Catatan (opsional)"}>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alasan / arahan…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
            <Button variant="outline" className="text-red-600 dark:text-red-400" onClick={() => decide(false)} disabled={busy}>
              {busy && isDesign ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Tolak
            </Button>
            {!isDesign && (
              <Button onClick={() => decide(true)} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Setujui
              </Button>
            )}
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

/** Menutup rekrutmen & pelatihan. Design punya jalurnya sendiri (Kirim Hasil → ACC). */
function CompleteDialog({ r, onClose, onDone }: { r: HcRequest; onClose: () => void; onDone: () => void }) {
  const isRecruit = r.kind === "rekrutmen";
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
      toast.success("Ditandai terlaksana");
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
              : "Tandai bahwa program pelatihannya sudah benar-benar dijalankan."}
          </p>
          {isRecruit && (
            <Field label={`Jumlah Direkrut (dari ${r.headcount} diminta)`}>
              <Input type="number" min={0} value={recruited} onChange={(e) => setRecruited(e.target.value)} />
            </Field>
          )}
          <Field
            label={isRecruit ? "Bukti (offering letter / SK)" : "Bukti (laporan, daftar hadir, foto kegiatan)"}
            hint={UPLOAD_HINT}
          >
            <FilePicker files={files} onChange={setFiles} disabled={busy} label="Unggah bukti" />
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
 * Designer menyerahkan hasil pekerjaannya.
 *
 * Bedanya dengan "Tandai Selesai" yang lama bukan sekadar nama tombol: berkas
 * yang diunggah di sini TIDAK langsung sampai ke pemohon. Ia menunggu di
 * pengajuan yang sama sampai atasannya membukanya, dan itulah yang diminta —
 * supaya tidak ada lagi hasil yang sampai ke supervisor sebelum ada yang
 * sempat melihatnya.
 */
function KirimHasilDialog({ r, onClose, onDone }: { r: HcRequest; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<UploadProgress | null>(null);
  const ulang = (r.hasil?.tolakan.length ?? 0) > 0;

  async function submit() {
    if (files.length === 0) return toast.error("Lampirkan dulu berkas hasil designnya.");
    setBusy(true);
    setProgress(null);
    try {
      const attachments = await uploadAll(files, setProgress);
      const res = await submitDesignResultAction({ id: r.id, note, attachments });
      if (res.error) return toast.error(res.error);
      toast.success(
        res.langsungTerkirim
          ? `Hasil terkirim ke ${r.requesterName}`
          : "Hasil dikirim — menunggu ACC atasan sebelum sampai ke pemohon",
      );
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
      <DialogContent title={ulang ? "Kirim Ulang Hasil Design" : "Kirim Hasil Design"} description={r.title} align="center" className="max-w-md">
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
          <p className="rounded-lg bg-brand-500/10 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            Hasilnya diperiksa atasan dulu. Setelah di-ACC, berkasnya baru muncul di halaman pengajuan{" "}
            <b className="text-foreground">{r.requesterName}</b>.
          </p>

          {/* Alasan pengembalian terakhir ditaruh DI SINI, bukan cuma di rincian
              kartu: yang perlu membacanya adalah orang yang sedang mengunggah
              perbaikannya, tepat saat ia mengunggahnya. */}
          {ulang && r.hasil && (
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/[0.07] p-3">
              <p className="text-[11px] font-semibold text-orange-700 dark:text-orange-300">
                Dikembalikan {r.hasil.tolakan[r.hasil.tolakan.length - 1].byName}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-[12px] text-foreground/85">
                {r.hasil.tolakan[r.hasil.tolakan.length - 1].note}
              </p>
            </div>
          )}

          <Field label="Hasil design (JPG / PNG / PDF)" hint={UPLOAD_HINT}>
            <FilePicker files={files} onChange={setFiles} disabled={busy} label="Unggah hasil design" />
          </Field>
          <Field label="Catatan untuk atasan (opsional)">
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Yang perlu diperhatikan sebelum dikirim ke pemohon…"
            />
          </Field>

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
            <Button onClick={submit} disabled={busy || files.length === 0}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <SendHorizonal className="size-4" />} Kirim
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Atasan memeriksa hasil sebelum ia keluar dari tim.
 *
 * Berkasnya ditampilkan lengkap di sini — memutuskan tanpa membukanya sama saja
 * dengan tidak memeriksa. Dua jalan keluar: diteruskan ke pemohon, atau
 * dikembalikan ke designer dengan alasan yang WAJIB ditulis. Tidak ada tombol
 * "tolak permintaannya": yang dikembalikan hasilnya, sementara permintaan
 * pemohon masih berdiri dan tetap harus dipenuhi.
 */
function AccHasilDialog({ r, onClose, onDone }: { r: HcRequest; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function putuskan(approve: boolean) {
    if (!approve && !note.trim()) return toast.error("Tulis dulu apa yang perlu diperbaiki.");
    setBusy(true);
    const res = await accDesignResultAction({ id: r.id, approve, note });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(approve ? `Hasil terkirim ke ${r.requesterName}` : "Hasil dikembalikan ke designer");
    onClose();
    onDone();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Periksa Hasil Design" description={r.title} align="center" className="max-w-md">
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground">
              Dikirim <b className="text-foreground">{r.hasil?.byName ?? "—"}</b> untuk{" "}
              <b className="text-foreground">{r.requesterName}</b>
            </p>
            {r.hasil?.note && (
              <p className="mt-1 whitespace-pre-wrap text-[12px] text-foreground/85">{r.hasil.note}</p>
            )}
            {r.hasil && r.hasil.attachments.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.hasil.attachments.map((a, i) => <FileChip key={i} a={a} />)}
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                Belum ada berkas hasil — pekerjaannya ditutup dari Work Tracker tanpa mengunggah apa pun.
                Kembalikan supaya designer mengirim berkasnya.
              </p>
            )}
          </div>

          <Field label="Catatan">
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Wajib diisi bila dikembalikan — apa yang perlu diperbaiki…"
            />
          </Field>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
            <Button variant="outline" onClick={() => putuskan(false)} disabled={busy}>
              <Undo2 className="size-4" /> Kembalikan
            </Button>
            <Button onClick={() => putuskan(true)} disabled={busy || !r.hasil?.attachments.length}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} ACC & Kirim
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
  kelola,
  meId,
  onClose,
  onDone,
}: {
  r: HcRequest;
  picOptions: PicOption[];
  kelola: boolean;
  meId?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  // Yang mengerjakan hanya bisa menugaskan SATU orang: dirinya sendiri.
  // Menampilkan daftar nama rekan padahal server akan menolaknya hanya
  // memancing kekecewaan — jadi pilihannya memang tidak ditawarkan.
  const [pic, setPic] = React.useState(kelola ? (r.assigneeId ?? "") : (meId ?? ""));
  const [busy, setBusy] = React.useState(false);

  async function save() {
    if (!pic) return toast.error(kelola ? "Pilih PIC yang mengerjakan." : "Akun Anda belum dikenali, muat ulang halaman.");
    setBusy(true);
    const res = await assignDesignRequestAction({ id: r.id, assigneeId: pic });
    setBusy(false);
    if (res?.error) return toast.error(res.error);
    const name = picOptions.find((p) => p.id === pic)?.name ?? "PIC";
    toast.success(
      kelola
        ? `Dikerjakan oleh ${name} — tugasnya masuk Work Tracker Creative`
        : "Pekerjaan ini sekarang milik Anda — tugasnya masuk Work Tracker Creative",
    );
    onClose();
    onDone();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        align="center"
        title={kelola ? (r.assigneeName ? "Ganti PIC Pengerjaan" : "Tugaskan PIC Pengerjaan") : "Ambil Pekerjaan Ini"}
        description={r.title}
        className="max-w-md"
      >
        <div className="space-y-4 p-5">
          {!kelola ? (
            <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              Pekerjaan ini akan tercatat atas nama Anda dan hilang dari daftar rekan yang lain. Tugasnya juga langsung
              muncul di <b className="text-foreground">Work Tracker Creative</b>.
            </p>
          ) : picOptions.length === 0 ? (
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

          {kelola && (
            <p className="rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
              Setelah ditugaskan, tugas otomatis muncul di <b className="text-foreground">Work Tracker Creative</b> atas
              nama PIC. Menandai tugas itu selesai akan menutup permintaan design ini, begitu pula sebaliknya.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Batal
            </Button>
            <Button onClick={save} disabled={busy || (kelola && picOptions.length === 0) || (!kelola && !meId)}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <UserRound className="size-4" />}{" "}
              {kelola ? "Simpan" : "Ambil"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
