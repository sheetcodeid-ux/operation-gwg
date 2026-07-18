"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ConciergeBell, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { HOSPITALITY_CHECKLISTS } from "@/lib/constants";
import type { HospitalityCategory } from "@/lib/types";
import { createHospitalityAction } from "@/lib/actions/hospitality";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, useDialogControl } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { ScoreRing } from "@/components/ui/score-ring";
import { TONE_PILL } from "@/components/ui/tone";
import { cn } from "@/lib/utils";

type Scores = Record<HospitalityCategory, Record<string, number>>;

const CATS = Object.keys(HOSPITALITY_CHECKLISTS) as HospitalityCategory[];
const POSITIONS = ["Bar", "Kitchen", "Kasir", "Supervisor", "Staff"];
const todayLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Start unrated (0 = belum dinilai) — the supervisor must score each item. */
function emptyScores(): Scores {
  const s = {} as Scores;
  for (const cat of CATS) {
    s[cat] = {};
    for (const item of HOSPITALITY_CHECKLISTS[cat].items) s[cat][item.key] = 0;
  }
  return s;
}

/** Number of items scored / total, overall or for one category. */
function scoredOf(scores: Scores, cat?: HospitalityCategory) {
  const cats = cat ? [cat] : CATS;
  let scored = 0;
  let total = 0;
  for (const c of cats) {
    for (const item of HOSPITALITY_CHECKLISTS[c].items) {
      total += 1;
      if (scores[c][item.key] > 0) scored += 1;
    }
  }
  return { scored, total };
}

/** Colour ramp for the 1–5 scale: 1 red → 5 emerald (never all-black). */
const SCORE_TONE: Record<number, string> = {
  1: "bg-red-500 text-white ring-1 ring-inset ring-red-500/30 shadow-sm",
  2: "bg-orange-500 text-white ring-1 ring-inset ring-orange-500/30 shadow-sm",
  3: "bg-amber-500 text-white ring-1 ring-inset ring-amber-500/30 shadow-sm",
  4: "bg-lime-500 text-white ring-1 ring-inset ring-lime-500/30 shadow-sm",
  5: "bg-emerald-500 text-white ring-1 ring-inset ring-emerald-500/30 shadow-sm",
};

export function NewAssessmentButton({
  outlets,
  supervisors,
  defaultAssessorId,
}: {
  outlets: { id: string; name: string }[];
  supervisors: { id: string; name: string }[];
  defaultAssessorId?: string;
}) {
  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm">
          <Plus /> Assessment Baru
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Hospitality Assessment"
        description="Kunjungan Supervisor — skor layanan cashier, F&B & dining."
        align="center"
        className="max-w-2xl"
      >
        <AssessmentForm outlets={outlets} supervisors={supervisors} defaultAssessorId={defaultAssessorId} />
      </DialogContent>
    </Dialog>
  );
}

function AssessmentForm({
  outlets,
  supervisors,
  defaultAssessorId,
}: {
  outlets: { id: string; name: string }[];
  supervisors: { id: string; name: string }[];
  defaultAssessorId?: string;
}) {
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, startTransition] = useTransition();
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "");
  const [supervisorId, setSupervisorId] = useState(defaultAssessorId ?? supervisors[0]?.id ?? "");
  const [date, setDate] = useState(todayLocal());
  const [staffName, setStaffName] = useState("");
  const [staffPosition, setStaffPosition] = useState(POSITIONS[0]);
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState<Scores>(emptyScores);
  const [openCat, setOpenCat] = useState<HospitalityCategory>(CATS[0]);

  const { overall, scored, total } = useMemo(() => {
    let sum = 0;
    let scored = 0;
    let total = 0;
    for (const cat of CATS) {
      for (const item of HOSPITALITY_CHECKLISTS[cat].items) {
        total += 1;
        const v = scores[cat][item.key];
        if (v > 0) {
          sum += v;
          scored += 1;
        }
      }
    }
    return { overall: scored ? Math.round((sum / (scored * 5)) * 1000) / 10 : 0, scored, total };
  }, [scores]);

  const complete = scored === total;

  function setScore(cat: HospitalityCategory, key: string, value: number) {
    setScores((prev) => ({ ...prev, [cat]: { ...prev[cat], [key]: value } }));
  }

  function submit() {
    if (!staffName.trim()) {
      toast.error("Nama staff wajib diisi.");
      return;
    }
    if (!complete) {
      const firstIncomplete = CATS.find((cat) => scoredOf(scores, cat).scored < scoredOf(scores, cat).total);
      if (firstIncomplete) setOpenCat(firstIncomplete);
      toast.error(`Penilaian belum lengkap — masih ada ${total - scored} item belum dinilai.`);
      return;
    }
    startTransition(async () => {
      const res = await createHospitalityAction({ outletId, coordinatorId: supervisorId, staffName, staffPosition, scores, notes, date: new Date(`${date}T12:00:00`).toISOString() });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Assessment saved · score ${res?.score?.toFixed(1)}`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="max-h-[72vh] overflow-y-auto p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Outlet">
          <Combobox
            value={outletId}
            onChange={setOutletId}
            options={outlets.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Pilih outlet"
            searchPlaceholder="Cari outlet…"
          />
        </Field>
        <Field label="Tanggal">
          <DatePicker value={date} onChange={setDate} />
        </Field>
        <Field label="Supervisor">
          <Combobox
            value={supervisorId}
            onChange={setSupervisorId}
            options={supervisors.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Pilih supervisor"
            searchPlaceholder="Cari supervisor…"
          />
        </Field>
        <Field label="Nama Staff">
          <Input value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="mis. Andi" />
        </Field>
        <Field label="Posisi">
          <Combobox value={staffPosition} onChange={setStaffPosition} options={POSITIONS.map((p) => ({ value: p, label: p }))} />
        </Field>
      </div>

      <div className="my-4 flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
        <ScoreRing value={overall} size={56} stroke={5} label="Skor" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Skor hospitality langsung</p>
          <p className="text-xs text-muted-foreground">
            {complete ? "Dihitung otomatis dari seluruh item (1–5)." : `${scored}/${total} item dinilai — lengkapi semua.`}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            !complete
              ? TONE_PILL.warning
              : overall >= 85
                ? TONE_PILL.success
                : overall >= 70
                  ? TONE_PILL.cyan
                  : overall >= 55
                    ? TONE_PILL.warning
                    : TONE_PILL.danger,
          )}
        >
          {!complete ? "Belum lengkap" : overall >= 85 ? "Sangat Baik" : overall >= 70 ? "Baik" : overall >= 55 ? "Cukup" : "Perlu Perhatian"}
        </span>
      </div>

      <div className="space-y-2">
        {CATS.map((cat) => {
          const open = openCat === cat;
          const meta = HOSPITALITY_CHECKLISTS[cat];
          const catProgress = scoredOf(scores, cat);
          const catDone = catProgress.scored === catProgress.total;
          return (
            <div key={cat} className="overflow-hidden rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setOpenCat(open ? ("" as HospitalityCategory) : cat)}
                className="flex w-full items-center justify-between gap-2 bg-muted/30 px-3 py-2.5 text-left hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <ConciergeBell className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">{meta.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                      catDone
                        ? "bg-brand-500/12 text-brand-600 dark:text-brand-400"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {catProgress.scored}/{catProgress.total}
                  </span>
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                </div>
              </button>
              {open && (
                <div className="space-y-1.5 p-3">
                  {meta.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-foreground/80">{item.label}</span>
                      <ScoreSelect value={scores[cat][item.key]} onChange={(v) => setScore(cat, item.key, v)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Field label="Catatan (opsional)" className="mt-4">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observasi, catatan coaching…" />
      </Field>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Batal
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Simpan Assessment
        </Button>
      </div>
    </div>
  );
}

function ScoreSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "size-7 rounded-md text-xs font-semibold tabular-nums transition-all",
            value === n ? SCORE_TONE[n] : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
