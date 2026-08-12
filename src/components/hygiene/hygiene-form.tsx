"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Plus, SprayCan, X } from "lucide-react";
import { toast } from "sonner";
import { HYGIENE_PHOTO_GROUPS, HYGIENE_PHOTO_GROUPS_OPTIONAL, HYGIENE_RATING_META, HYGIENE_SECTIONS } from "@/lib/constants";
import type { Attachment, HygieneRating, HygieneSection } from "@/lib/types";
import { createHygieneAction, uploadHygienePhotosAction } from "@/lib/actions/hygiene";
import { presignHygieneUploadsAction } from "@/lib/actions/uploads";
import { clearDraft, draftAge, loadDraft, saveDraft } from "@/lib/draft-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, useDialogControl } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { CameraCapture, type CapturedPhoto } from "@/components/ui/camera-capture";
import { ScoreRing } from "@/components/ui/score-ring";
import { TONE_PILL } from "@/components/ui/tone";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const MIN_PHOTOS = 3;

/**
 * Satu percobaan PUT, dengan kemajuan byte dan batas waktu.
 *
 * Memakai XMLHttpRequest, bukan fetch, karena dua hal yang keduanya terlihat
 * di laporan lapangan:
 *
 *  • fetch tidak melaporkan kemajuan pengiriman, jadi bilahnya menampilkan 0%
 *    selama unggahan berjalan. Rekaman layar 41 detik penuh angka 0% tidak
 *    bisa dibedakan dari aplikasi yang menggantung.
 *  • fetch tidak punya batas waktu. Sinyal yang mati di tengah kirim membuat
 *    permintaannya menggantung SELAMANYA — bukan gagal, hanya diam.
 */
function putOnce(url: string, file: File, onBytes: (loaded: number) => void, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.timeout = timeoutMs;
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onBytes(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      const detail = (xhr.responseText || "").replace(/<[^>]+>/g, " ").slice(0, 100).trim();
      const err = new Error(`${xhr.status} ${detail}`.trim());
      // Ditandai supaya pemanggil tahu mengulang tidak ada gunanya.
      (err as Error & { status?: number }).status = xhr.status;
      reject(err);
    };
    xhr.ontimeout = () => reject(new Error("jaringan terlalu lambat (waktu habis)"));
    xhr.onerror = () =>
      reject(new Error("koneksi ke penyimpanan ditolak — periksa izin CORS bucket R2"));
    xhr.send(file);
  });
}

async function putPhotoWithRetry(
  url: string,
  file: File,
  name: string,
  onBytes: (loaded: number) => void,
  attempts = 3,
): Promise<void> {
  let lastMessage = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      // Batas waktu naik tiap percobaan: sinyal lapangan yang lambat masih
      // punya kesempatan, tapi yang benar-benar mati tetap menyerah.
      await putOnce(url, file, onBytes, 30_000 * attempt);
      return;
    } catch (e) {
      const err = e as Error & { status?: number };
      lastMessage = err.message || "koneksi terputus";
      // 4xx selain 408/429 berarti permintaannya memang ditolak — mengulang
      // hanya membuang waktu petugas.
      const s = err.status;
      if (s != null && s >= 400 && s < 500 && s !== 408 && s !== 429) break;
    }
    // Setiap percobaan mulai dari nol byte lagi.
    onBytes(0);
    if (attempt < attempts) await new Promise((r) => setTimeout(r, attempt * 1200));
  }
  throw new Error(`"${name}" gagal setelah ${attempts}× percobaan (${lastMessage}).`);
}

/** One draft per device — a supervisor fills one inspection at a time. */
const DRAFT_KEY = "hygiene-form";

interface HygieneDraft {
  outletId: string;
  date: string;
  shift: string;
  inspectorName: string;
  ratings: Ratings;
  findings: string[];
  /** Captured photos kept as real Files so they survive a reload. */
  photos: Record<string, File[]>;
}

// Keep each upload request comfortably under the Server Action body limit.
const MAX_BATCH_BYTES = 3.5 * 1024 * 1024;

/** Group photo entries into batches whose cumulative size stays under `limit`.
 *  A single oversized file still goes out alone (server enforces its own cap). */
function batchBySize<T extends { file: File }>(entries: T[], limit: number): T[][] {
  const batches: T[][] = [];
  let cur: T[] = [];
  let size = 0;
  for (const e of entries) {
    if (cur.length > 0 && size + e.file.size > limit) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(e);
    size += e.file.size;
  }
  if (cur.length > 0) batches.push(cur);
  return batches;
}

const todayLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const SECTIONS = Object.keys(HYGIENE_SECTIONS) as HygieneSection[];
const RATINGS = Object.keys(HYGIENE_RATING_META) as HygieneRating[];
// Compact codes + solid colours so the four levels fit inline (label left,
// buttons right) without overlapping on a phone. A legend keeps them clear.
const RATING_SHORT: Record<HygieneRating, string> = { excellent: "SB", good: "B", fair: "C", poor: "K" };
const RATING_BG: Record<HygieneRating, string> = {
  excellent: "bg-emerald-500",
  good: "bg-sky-500",
  fair: "bg-amber-500",
  poor: "bg-red-500",
};

type Ratings = Record<HygieneSection, Record<string, HygieneRating | undefined>>;

/** Start with no rating selected — the inspector must choose each one. */
function emptyRatings(): Ratings {
  const r = {} as Ratings;
  for (const sec of SECTIONS) r[sec] = {};
  return r;
}

/** Number of items rated / total, overall or for one section. */
function ratedOf(ratings: Ratings, sec?: HygieneSection) {
  const secs = sec ? [sec] : SECTIONS;
  let rated = 0;
  let total = 0;
  for (const s of secs) {
    for (const item of HYGIENE_SECTIONS[s].items) {
      total += 1;
      if (ratings[s][item.key]) rated += 1;
    }
  }
  return { rated, total };
}

export function NewAuditButton({ outlets }: { outlets: { id: string; name: string }[] }) {
  const { t } = useI18n();
  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm">
          <Plus /> {t("hygiene.new")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("hygiene.formTitle")} description={t("hygiene.formDesc")} align="center" className="max-w-2xl">
        <HygieneForm outlets={outlets} />
      </DialogContent>
    </Dialog>
  );
}

function HygieneForm({ outlets }: { outlets: { id: string; name: string }[] }) {
  const { t, td } = useI18n();
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, startTransition] = useTransition();
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "");
  const [date, setDate] = useState(todayLocal());
  const [shift, setShift] = useState("Shift 1");
  const [inspectorName, setInspectorName] = useState("");
  const [ratings, setRatings] = useState<Ratings>(emptyRatings);
  const [findings, setFindings] = useState<string[]>([]);
  const [findingDraft, setFindingDraft] = useState("");
  const [openSection, setOpenSection] = useState<HygieneSection>("front");
  const [photos, setPhotos] = useState<Record<string, CapturedPhoto[]>>({});
  // Kemajuan unggah foto — audit penuh bisa 20+ foto dan tanpa ini layarnya
  // tampak menggantung sampai selesai.
  const [uploadInfo, setUploadInfo] = useState<{ done: number; total: number; ratio: number } | null>(null);
  /**
   * Foto yang SUDAH berhasil naik ke R2, dikunci pada objek File-nya.
   *
   * Supervisor yang gagal di foto ke-23 dulu harus mengulang semuanya. Ref ini
   * bertahan antar percobaan simpan, jadi menekan Simpan lagi hanya
   * melanjutkan sisanya.
   */
  const doneRef = useRef<Map<File, Attachment>>(new Map());
  const outletName = outlets.find((o) => o.id === outletId)?.name;

  // ── Draft autosave (weak-signal safety) ──────────────────────────────────
  // Photos are stored as real Files in IndexedDB, so losing signal — or the tab
  // — no longer wipes an inspection that took an hour to shoot.
  const [restored, setRestored] = useState<number | null>(null);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    let live = true;
    loadDraft<HygieneDraft>(DRAFT_KEY).then((env) => {
      if (!live || !env) {
        if (live) setHydrating(false);
        return;
      }
      const d = env.data;
      if (d.outletId) setOutletId(d.outletId);
      if (d.date) setDate(d.date);
      if (d.shift) setShift(d.shift);
      if (d.inspectorName) setInspectorName(d.inspectorName);
      if (d.ratings) setRatings(d.ratings);
      if (d.findings) setFindings(d.findings);
      if (d.photos) {
        // Rebuild preview URLs — object URLs from the old page are dead.
        const revived: Record<string, CapturedPhoto[]> = {};
        for (const [label, files] of Object.entries(d.photos)) {
          revived[label] = files.map((file) => ({ file, url: URL.createObjectURL(file) }));
        }
        setPhotos(revived);
      }
      setRestored(env.savedAt);
      setHydrating(false);
    });
    return () => { live = false; };
  }, []);

  // Debounced save — cheap, and only after the initial hydrate so we never
  // overwrite a good draft with the empty initial state.
  useEffect(() => {
    if (hydrating) return;
    const id = setTimeout(() => {
      const photoFiles: Record<string, File[]> = {};
      for (const [label, items] of Object.entries(photos)) photoFiles[label] = items.map((i) => i.file);
      void saveDraft<HygieneDraft>(DRAFT_KEY, { outletId, date, shift, inspectorName, ratings, findings, photos: photoFiles });
    }, 600);
    return () => clearTimeout(id);
  }, [hydrating, outletId, date, shift, inspectorName, ratings, findings, photos]);

  const { score, rated, total } = useMemo(() => {
    let sum = 0;
    let rated = 0;
    let total = 0;
    for (const sec of SECTIONS) {
      for (const item of HYGIENE_SECTIONS[sec].items) {
        total += 1;
        const r = ratings[sec][item.key];
        if (r) {
          sum += HYGIENE_RATING_META[r].score;
          rated += 1;
        }
      }
    }
    return { score: rated ? Math.round((sum / rated) * 10) / 10 : 0, rated, total };
  }, [ratings]);

  const complete = rated === total;
  const isClean = score >= 70;

  function setRating(sec: HygieneSection, key: string, value: HygieneRating) {
    setRatings((prev) => ({ ...prev, [sec]: { ...prev[sec], [key]: value } }));
  }

  function addFinding() {
    if (!findingDraft.trim()) return;
    setFindings((f) => [...f, findingDraft.trim()]);
    setFindingDraft("");
  }

  function submit() {
    // Require every item to be rated (no blank penilaian).
    if (!complete) {
      const firstIncomplete = SECTIONS.find((sec) => ratedOf(ratings, sec).rated < ratedOf(ratings, sec).total);
      if (firstIncomplete) setOpenSection(firstIncomplete);
      toast.error(`Penilaian belum lengkap — masih ada ${total - rated} item belum dinilai.`);
      return;
    }
    // Require min photos per documentation area (camera + timestamp).
    const missing = HYGIENE_PHOTO_GROUPS.filter((g) => (photos[g]?.length ?? 0) < MIN_PHOTOS);
    if (missing.length > 0) {
      toast.error(`Minimal ${MIN_PHOTOS} foto per area. Kurang: ${missing.join(", ")}.`);
      return;
    }
    // All items rated → build a fully-typed ratings object for the action.
    const fullRatings = {} as Record<HygieneSection, Record<string, HygieneRating>>;
    for (const sec of SECTIONS) {
      fullRatings[sec] = {};
      for (const item of HYGIENE_SECTIONS[sec].items) fullRatings[sec][item.key] = ratings[sec][item.key]!;
    }
    startTransition(async () => {
      // Upload attached photos to Supabase Storage first (permanent URLs).
      // Server Actions cap the request body (default 1 MB), so upload in
      // size-bounded batches instead of one giant request.
      let uploaded: Attachment[] = [];
      const entries = Object.entries(photos).flatMap(([label, items]) => items.map((it) => ({ label, file: it.file })));

      /**
       * Unggah lewat server (Supabase Storage), dipecah agar tiap permintaan
       * tetap di bawah batas badan server action.
       *
       * Ini BUKAN jalur darurat yang jelek: foto audit sudah dimampatkan ke
       * ~100 KB, jadi 24 foto pun hanya sekitar 2,5 MB — satu atau dua
       * permintaan saja.
       */
      const unggahLewatServer = async (list: typeof entries): Promise<Attachment[] | "storage-mati"> => {
        const out: Attachment[] = [];
        const batches = batchBySize(list, MAX_BATCH_BYTES);
        for (let i = 0; i < batches.length; i++) {
          setUploadInfo({ done: i, total: batches.length, ratio: i / batches.length });
          const fd = new FormData();
          for (const e of batches[i]) {
            fd.append("file", e.file);
            fd.append("label", e.label);
          }
          const up = await uploadHygienePhotosAction(fd);
          if (up.error) {
            if (up.error.includes("Storage belum aktif")) return "storage-mati";
            throw new Error(up.error);
          }
          out.push(...(up.photos ?? []));
        }
        return out;
      };

      if (entries.length > 0) {
        const presign = await presignHygieneUploadsAction(entries.map((e) => ({ name: e.file.name, type: e.file.type })));
        if ("error" in presign) {
          toast.error(presign.error);
          return;
        }

        // Jalur utama: langsung ke R2 supaya fotonya tidak melewati server.
        let r2Gagal = false;
        if (presign.mode === "r2") {
          const totalBytes = entries.reduce((sum, e) => sum + e.file.size, 0) || 1;
          let doneBytes = 0;
          try {
            for (let i = 0; i < entries.length; i++) {
              // Foto yang SUDAH naik di percobaan sebelumnya tidak diulang.
              if (doneRef.current.has(entries[i].file)) {
                doneBytes += entries[i].file.size;
                uploaded.push(doneRef.current.get(entries[i].file)!);
                setUploadInfo({ done: i + 1, total: entries.length, ratio: doneBytes / totalBytes });
                continue;
              }
              const { id, url } = presign.items[i];
              setUploadInfo({ done: i, total: entries.length, ratio: doneBytes / totalBytes });
              // Foto PERTAMA dicoba sekali saja.
              //
              // Kalau R2 memang menolak (izin CORS bucket belum dibuka), tiga
              // percobaan dengan batas waktu menaik berarti petugas menunggu
              // sampai satu setengah menit sebelum tahu gagal. Kegagalan di
              // foto pertama hampir pasti soal izin, bukan sinyal — jadi lebih
              // baik cepat menyerah dan pindah jalur.
              const percobaan = uploaded.length === 0 ? 1 : 3;
              await putPhotoWithRetry(
                url,
                entries[i].file,
                entries[i].file.name,
                (loaded) =>
                  setUploadInfo({ done: i, total: entries.length, ratio: Math.min(1, (doneBytes + loaded) / totalBytes) }),
                percobaan,
              );
              const att: Attachment = { id, name: entries[i].label || entries[i].file.name, url: "", kind: "photo", size: entries[i].file.size };
              doneRef.current.set(entries[i].file, att);
              uploaded.push(att);
              doneBytes += entries[i].file.size;
            }
            setUploadInfo({ done: entries.length, total: entries.length, ratio: 1 });
          } catch {
            // R2 menolak. JANGAN gagalkan auditnya — fotonya kecil, jalur
            // server masih sangat mungkin. Inilah yang dulu tidak ada:
            // presign berhasil, PUT-nya ditolak CORS, dan seluruh audit hangus
            // padahal ada jalur lain yang bekerja.
            r2Gagal = true;
          }
        }

        if (presign.mode !== "r2" || r2Gagal) {
          // Yang sudah berhasil naik ke R2 tidak diulang lewat server.
          const sisa = entries.filter((e) => !doneRef.current.has(e.file));
          try {
            const hasil = await unggahLewatServer(sisa);
            if (hasil === "storage-mati") {
              toast.info("Penyimpanan foto belum aktif — audit disimpan tanpa foto.");
              uploaded = [];
            } else {
              uploaded = [...uploaded, ...hasil];
              if (r2Gagal) toast.info("Penyimpanan langsung sedang bermasalah — foto dikirim lewat server.");
            }
          } catch (e) {
            toast.error(
              `Gagal mengunggah foto: ${e instanceof Error ? e.message : "koneksi bermasalah"}. Tekan Simpan lagi untuk mencoba ulang.`,
              { duration: 8000 },
            );
            return;
          } finally {
            setUploadInfo(null);
          }
        }
        setUploadInfo(null);
      }

      const res = await createHygieneAction({ outletId, shift, inspectorName, ratings: fullRatings, findings, isClean, photos: uploaded, date: new Date(`${date}T12:00:00`).toISOString() });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Audit saved · hygiene score ${res?.score?.toFixed(1)}`);
      void clearDraft(DRAFT_KEY); // submitted — the safety copy is no longer needed
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="max-h-[72vh] overflow-y-auto p-5">
      {restored !== null && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <span className="min-w-0 flex-1">
            Draft dipulihkan (tersimpan {draftAge(restored)}) — penilaian &amp; foto Anda tidak hilang.
          </span>
          <button
            type="button"
            onClick={() => {
              void clearDraft(DRAFT_KEY);
              setRatings(emptyRatings());
              setFindings([]);
              setPhotos({});
              setInspectorName("");
              setDate(todayLocal());
              // Tanpa ini, "Mulai baru" menyisakan catatan foto lama yang sudah
              // diunggah, dan audit yang benar-benar baru bisa memungut
              // lampiran audit sebelumnya.
              doneRef.current.clear();
              setRestored(null);
            }}
            className="shrink-0 rounded-md bg-amber-600 px-2 py-1 font-semibold text-white hover:bg-amber-700"
          >
            Mulai baru
          </button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("common.outlet")}>
          <Combobox
            value={outletId}
            onChange={setOutletId}
            options={outlets.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Pilih outlet"
            searchPlaceholder="Cari outlet…"
          />
        </Field>
        <Field label={t("common.date")}>
          <DatePicker value={date} onChange={setDate} />
        </Field>
        <Field label={t("hygiene.shift")}>
          <Combobox
            value={shift}
            onChange={setShift}
            options={["Shift 1", "Shift 2", "Shift 3"].map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field label={t("hygiene.inspector")}>
          <Input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} placeholder={t("hygiene.inspectorPh")} />
        </Field>
      </div>

      <div className="my-4 flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
        <ScoreRing value={score} size={56} stroke={5} label="Higiene" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">{t("hygiene.liveScore")}</p>
          <p className="text-xs text-muted-foreground">
            {complete ? t("hygiene.liveScoreAuto") : `${rated}/${total} ${t("hygiene.rated")}`}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            !complete ? TONE_PILL.warning : isClean ? TONE_PILL.success : TONE_PILL.danger,
          )}
        >
          {!complete ? t("hygiene.incomplete") : isClean ? t("hygiene.cleanOutlet") : t("hygiene.needAttention")}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {RATINGS.map((r) => (
          <span key={r} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("grid size-4 place-items-center rounded text-[9px] font-bold text-white", RATING_BG[r])}>{RATING_SHORT[r]}</span>
            {td(HYGIENE_RATING_META[r].label)}
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {SECTIONS.map((sec) => {
          const meta = HYGIENE_SECTIONS[sec];
          const open = openSection === sec;
          const secProgress = ratedOf(ratings, sec);
          const secDone = secProgress.rated === secProgress.total;
          return (
            <div key={sec} className="overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setOpenSection(open ? ("" as HygieneSection) : sec)}
                className="flex w-full items-center justify-between gap-2 bg-muted/30 px-3 py-2.5 text-left hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <SprayCan className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{td(meta.label)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{meta.subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                      secDone
                        ? "bg-brand-500/12 text-brand-600 dark:text-brand-400"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {secProgress.rated}/{secProgress.total}
                  </span>
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                </div>
              </button>
              {open && (
                <div className="space-y-2 p-3">
                  {meta.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 text-sm text-foreground/80">{td(item.label)}</span>
                      <div className="flex shrink-0 gap-1">
                        {RATINGS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            title={td(HYGIENE_RATING_META[r].label)}
                            aria-label={td(HYGIENE_RATING_META[r].label)}
                            onClick={() => setRating(sec, item.key, r)}
                            className={cn(
                              "h-8 min-w-8 rounded-md px-1.5 text-[11px] font-semibold tabular-nums transition-all",
                              ratings[sec][item.key] === r
                                ? cn(RATING_BG[r], "text-white shadow-sm")
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                          >
                            {RATING_SHORT[r]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dokumentasi — foto langsung dari kamera HP, timestamp ter-cap, min 3 per area. */}
      <Field label={t("hygiene.documentation")} className="mt-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HYGIENE_PHOTO_GROUPS.map((g) => (
            <CameraCapture
              key={g}
              label={td(g)}
              min={MIN_PHOTOS}
              max={MIN_PHOTOS}
              stampPrefix={outletName}
              items={photos[g] ?? []}
              onChange={(items) => setPhotos((p) => ({ ...p, [g]: items }))}
            />
          ))}
        </div>
      </Field>

      {/* Etalase hanya ada di sebagian outlet, jadi tidak ikut syarat minimum
          foto — audit tetap bisa disimpan kalau dikosongkan. */}
      <Field label="Etalase (opsional)" className="mt-4">
        <p className="mb-2 text-[11px] text-muted-foreground">
          Isi hanya bila outlet ini punya etalasenya. Kalau tidak ada, boleh dilewati.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HYGIENE_PHOTO_GROUPS_OPTIONAL.map((g) => (
            <CameraCapture
              key={g}
              label={g}
              min={0}
              max={MIN_PHOTOS}
              stampPrefix={outletName}
              items={photos[g] ?? []}
              onChange={(items) => setPhotos((p) => ({ ...p, [g]: items }))}
            />
          ))}
        </div>
      </Field>

      <Field label={t("hygiene.findings")} className="mt-4">
        <div className="flex gap-2">
          <Input
            value={findingDraft}
            onChange={(e) => setFindingDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFinding())}
            placeholder={t("hygiene.findingsPh")}
          />
          <Button type="button" variant="subtle" onClick={addFinding}>
            {t("common.add")}
          </Button>
        </div>
        {findings.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {findings.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs text-amber-200">
                {f}
                <button type="button" onClick={() => setFindings((arr) => arr.filter((_, j) => j !== i))}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Field>

      {uploadInfo && (
        <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-foreground/80">
              Mengunggah foto {Math.min(uploadInfo.done + 1, uploadInfo.total)}/{uploadInfo.total}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {Math.round(uploadInfo.ratio * 100)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${Math.round(uploadInfo.ratio * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">Jangan tutup halaman ini sampai selesai.</p>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          {t("common.cancel")}
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} {t("hygiene.save")}
        </Button>
      </div>
    </div>
  );
}

