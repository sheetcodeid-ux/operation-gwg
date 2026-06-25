"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ImagePlus, Loader2, Plus, SprayCan, X } from "lucide-react";
import { toast } from "sonner";
import { HYGIENE_PHOTO_GROUPS, HYGIENE_RATING_META, HYGIENE_SECTIONS } from "@/lib/constants";
import type { HygieneRating, HygieneSection } from "@/lib/types";
import { createHygieneAction } from "@/lib/actions/hygiene";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, useDialogControl } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { ScoreRing } from "@/components/ui/score-ring";
import { TONE_PILL } from "@/components/ui/tone";
import { cn } from "@/lib/utils";

const SECTIONS = Object.keys(HYGIENE_SECTIONS) as HygieneSection[];
const RATINGS = Object.keys(HYGIENE_RATING_META) as HygieneRating[];

type Ratings = Record<HygieneSection, Record<string, HygieneRating>>;

function defaultRatings(): Ratings {
  const r = {} as Ratings;
  for (const sec of SECTIONS) {
    r[sec] = {};
    for (const item of HYGIENE_SECTIONS[sec].items) r[sec][item.key] = "good";
  }
  return r;
}

export function NewAuditButton({ outlets }: { outlets: { id: string; name: string }[] }) {
  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm">
          <Plus /> New Audit
        </Button>
      </DialogTrigger>
      <DialogContent title="Hygiene Audit" description="Inspect cleanliness across all six outlet sections." className="max-w-2xl">
        <HygieneForm outlets={outlets} />
      </DialogContent>
    </Dialog>
  );
}

function HygieneForm({ outlets }: { outlets: { id: string; name: string }[] }) {
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, startTransition] = useTransition();
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "");
  const [shift, setShift] = useState("Morning");
  const [inspectorName, setInspectorName] = useState("");
  const [ratings, setRatings] = useState<Ratings>(defaultRatings);
  const [findings, setFindings] = useState<string[]>([]);
  const [findingDraft, setFindingDraft] = useState("");
  const [openSection, setOpenSection] = useState<HygieneSection>("front");
  const [photos, setPhotos] = useState<Record<string, string[]>>({});

  const score = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const sec of SECTIONS) {
      for (const item of HYGIENE_SECTIONS[sec].items) {
        sum += HYGIENE_RATING_META[ratings[sec][item.key]].score;
        count += 1;
      }
    }
    return count ? Math.round((sum / count) * 10) / 10 : 0;
  }, [ratings]);

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
    startTransition(async () => {
      const res = await createHygieneAction({ outletId, shift, inspectorName, ratings, findings, isClean });
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
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Outlet">
          <Combobox
            value={outletId}
            onChange={setOutletId}
            options={outlets.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Select outlet"
            searchPlaceholder="Search outlets…"
          />
        </Field>
        <Field label="Shift">
          <Combobox
            value={shift}
            onChange={setShift}
            options={["Morning", "Afternoon", "Evening"].map((s) => ({ value: s, label: s }))}
          />
        </Field>
        <Field label="Inspector">
          <Input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} placeholder="Your name" />
        </Field>
      </div>

      <div className="my-4 flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
        <ScoreRing value={score} size={56} stroke={5} label="Hygiene" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Live hygiene score</p>
          <p className="text-xs text-muted-foreground">Auto-calculated across all six sections.</p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", isClean ? TONE_PILL.success : TONE_PILL.danger)}>
          {isClean ? "Outlet Clean" : "Needs Attention"}
        </span>
      </div>

      <div className="space-y-2">
        {SECTIONS.map((sec) => {
          const meta = HYGIENE_SECTIONS[sec];
          const open = openSection === sec;
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
                <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <div className="space-y-1.5 p-3">
                  {meta.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground/80">{item.label}</span>
                      <div className="flex gap-1">
                        {RATINGS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setRating(sec, item.key, r)}
                            className={cn(
                              "rounded-md px-2 py-1 text-[11px] font-medium transition-all",
                              ratings[sec][item.key] === r
                                ? TONE_PILL[HYGIENE_RATING_META[r].tone]
                                : "bg-muted/50 text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {HYGIENE_RATING_META[r].label}
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

      {/* Photo documentation — local preview now, Supabase Storage in Phase 11 */}
      <Field label="Documentation" className="mt-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HYGIENE_PHOTO_GROUPS.map((g) => (
            <PhotoGroup key={g} label={g} urls={photos[g] ?? []} onChange={(urls) => setPhotos((p) => ({ ...p, [g]: urls }))} />
          ))}
        </div>
      </Field>

      <Field label="Findings" className="mt-4">
        <div className="flex gap-2">
          <Input
            value={findingDraft}
            onChange={(e) => setFindingDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFinding())}
            placeholder="e.g. Lampu mati di toilet"
          />
          <Button type="button" variant="subtle" onClick={addFinding}>
            Add
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
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Save Audit
        </Button>
      </div>
    </div>
  );
}

function PhotoGroup({
  label,
  urls,
  onChange,
}: {
  label: string;
  urls: string[];
  onChange: (urls: string[]) => void;
}) {
  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    onChange([...urls, ...files.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  }
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-2">
      <label className="flex cursor-pointer flex-col items-center gap-1 py-1.5 text-center text-muted-foreground hover:text-foreground">
        <ImagePlus className="size-5" />
        <span className="text-[11px]">{label}</span>
        <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
      </label>
      {urls.length > 0 && (
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {urls.map((u, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-md ring-1 ring-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(urls.filter((_, j) => j !== i))}
                className="absolute right-0.5 top-0.5 grid size-4 place-items-center rounded bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
