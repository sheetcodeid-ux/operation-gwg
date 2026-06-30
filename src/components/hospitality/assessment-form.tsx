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
import { ScoreRing } from "@/components/ui/score-ring";
import { cn } from "@/lib/utils";

type Scores = Record<HospitalityCategory, Record<string, number>>;

const CATS = Object.keys(HOSPITALITY_CHECKLISTS) as HospitalityCategory[];
const POSITIONS = ["Bar", "Kitchen", "Kasir", "Supervisor", "Staff"];

function emptyScores(): Scores {
  const s = {} as Scores;
  for (const cat of CATS) {
    s[cat] = {};
    for (const item of HOSPITALITY_CHECKLISTS[cat].items) s[cat][item.key] = 4;
  }
  return s;
}

export function NewAssessmentButton({
  outlets,
  coordinators,
}: {
  outlets: { id: string; name: string }[];
  coordinators: { id: string; name: string }[];
}) {
  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm">
          <Plus /> New Assessment
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Hospitality Assessment"
        description="Kunjungan Coordinator Area — skor layanan cashier, F&B & dining."
        align="center"
        className="max-w-2xl"
      >
        <AssessmentForm outlets={outlets} coordinators={coordinators} />
      </DialogContent>
    </Dialog>
  );
}

function AssessmentForm({
  outlets,
  coordinators,
}: {
  outlets: { id: string; name: string }[];
  coordinators: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, startTransition] = useTransition();
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "");
  const [coordinatorId, setCoordinatorId] = useState(coordinators[0]?.id ?? "");
  const [staffName, setStaffName] = useState("");
  const [staffPosition, setStaffPosition] = useState(POSITIONS[0]);
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState<Scores>(emptyScores);
  const [openCat, setOpenCat] = useState<HospitalityCategory>(CATS[0]);

  const overall = useMemo(() => {
    let sum = 0;
    let count = 0;
    for (const cat of CATS) {
      for (const item of HOSPITALITY_CHECKLISTS[cat].items) {
        sum += scores[cat][item.key];
        count += 1;
      }
    }
    return count ? Math.round((sum / (count * 5)) * 1000) / 10 : 0;
  }, [scores]);

  function setScore(cat: HospitalityCategory, key: string, value: number) {
    setScores((prev) => ({ ...prev, [cat]: { ...prev[cat], [key]: value } }));
  }

  function submit() {
    if (!staffName.trim()) {
      toast.error("Staff name is required.");
      return;
    }
    startTransition(async () => {
      const res = await createHospitalityAction({ outletId, coordinatorId, staffName, staffPosition, scores, notes });
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
        <Field label="Coordinator Area">
          <Combobox
            value={coordinatorId}
            onChange={setCoordinatorId}
            options={coordinators.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Pilih coordinator"
            searchPlaceholder="Cari coordinator…"
          />
        </Field>
        <Field label="Staff Name">
          <Input value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="e.g. Andi" />
        </Field>
        <Field label="Position">
          <Combobox value={staffPosition} onChange={setStaffPosition} options={POSITIONS.map((p) => ({ value: p, label: p }))} />
        </Field>
      </div>

      <div className="my-4 flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
        <ScoreRing value={overall} size={56} stroke={5} label="Score" />
        <div>
          <p className="text-sm font-medium text-foreground">Live hospitality score</p>
          <p className="text-xs text-muted-foreground">Auto-calculated from all checklist items (1–5).</p>
        </div>
      </div>

      <div className="space-y-2">
        {CATS.map((cat) => {
          const open = openCat === cat;
          const meta = HOSPITALITY_CHECKLISTS[cat];
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
                <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
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

      <Field label="Notes (optional)" className="mt-4">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observations, coaching notes…" />
      </Field>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Save Assessment
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
            "size-7 rounded-md text-xs font-medium tabular-nums transition-all",
            value === n
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
