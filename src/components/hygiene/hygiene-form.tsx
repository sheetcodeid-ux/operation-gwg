"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Plus, SprayCan, X } from "lucide-react";
import { toast } from "sonner";
import { HYGIENE_PHOTO_GROUPS, HYGIENE_RATING_META, HYGIENE_SECTIONS } from "@/lib/constants";
import type { Attachment, HygieneRating, HygieneSection } from "@/lib/types";
import { createHygieneAction, uploadHygienePhotosAction } from "@/lib/actions/hygiene";
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
  const { t } = useI18n();
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, startTransition] = useTransition();
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "");
  const [date, setDate] = useState(todayLocal());
  const [shift, setShift] = useState("Morning");
  const [inspectorName, setInspectorName] = useState("");
  const [ratings, setRatings] = useState<Ratings>(emptyRatings);
  const [findings, setFindings] = useState<string[]>([]);
  const [findingDraft, setFindingDraft] = useState("");
  const [openSection, setOpenSection] = useState<HygieneSection>("front");
  const [photos, setPhotos] = useState<Record<string, CapturedPhoto[]>>({});
  const outletName = outlets.find((o) => o.id === outletId)?.name;

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
      if (entries.length > 0) {
        const batches = batchBySize(entries, MAX_BATCH_BYTES);
        for (const batch of batches) {
          const fd = new FormData();
          for (const e of batch) {
            fd.append("file", e.file);
            fd.append("label", e.label);
          }
          const up = await uploadHygienePhotosAction(fd);
          if (up.error) {
            // Demo mode without storage: save the audit anyway, photos skipped.
            if (up.error.includes("Storage belum aktif")) {
              toast.info("Storage belum aktif — audit disimpan tanpa foto.");
              uploaded = [];
              break;
            }
            toast.error(up.error);
            return;
          }
          uploaded = uploaded.concat(up.photos ?? []);
        }
      }

      const res = await createHygieneAction({ outletId, shift, inspectorName, ratings: fullRatings, findings, isClean, photos: uploaded, date: new Date(`${date}T12:00:00`).toISOString() });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Audit saved · hygiene score ${res?.score?.toFixed(1)}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="max-h-[72vh] overflow-y-auto p-5">
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
            options={["Pagi", "Siang", "Sore", "Malam"].map((s) => ({ value: s, label: s }))}
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
            {HYGIENE_RATING_META[r].label}
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
                    <p className="text-sm font-medium text-foreground">{meta.label}</p>
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
                      <span className="min-w-0 flex-1 text-sm text-foreground/80">{item.label}</span>
                      <div className="flex shrink-0 gap-1">
                        {RATINGS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            title={HYGIENE_RATING_META[r].label}
                            aria-label={HYGIENE_RATING_META[r].label}
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
              label={g}
              min={MIN_PHOTOS}
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

