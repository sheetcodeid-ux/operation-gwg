"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConciergeBell, Loader2, Plus } from "lucide-react";
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

function emptyScores(): Scores {
  const s = {} as Scores;
  for (const cat of CATS) {
    s[cat] = {};
    for (const item of HOSPITALITY_CHECKLISTS[cat].items) s[cat][item.key] = 4;
  }
  return s;
}

export function NewAssessmentButton({ outlets }: { outlets: { id: string; name: string }[] }) {
  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm">
          <Plus /> New Assessment
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Hospitality Assessment"
        description="Score service quality across cashier, F&B and dining area."
        className="max-w-2xl"
      >
        <AssessmentForm outlets={outlets} />
      </DialogContent>
    </Dialog>
  );
}

function AssessmentForm({ outlets }: { outlets: { id: string; name: string }[] }) {
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, startTransition] = useTransition();
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "");
  const [staffName, setStaffName] = useState("");
  const [staffPosition, setStaffPosition] = useState("");
  const [notes, setNotes] = useState("");
  const [scores, setScores] = useState<Scores>(emptyScores);

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
      const res = await createHospitalityAction({ outletId, staffName, staffPosition, scores, notes });
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
    <div className="max-h-[70vh] overflow-y-auto p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Outlet">
          <Combobox
            value={outletId}
            onChange={setOutletId}
            options={outlets.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Select outlet"
            searchPlaceholder="Search outlets…"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Staff Name">
            <Input value={staffName} onChange={(e) => setStaffName(e.target.value)} placeholder="e.g. Andi" />
          </Field>
          <Field label="Position">
            <Input value={staffPosition} onChange={(e) => setStaffPosition(e.target.value)} placeholder="e.g. Cashier" />
          </Field>
        </div>
      </div>

      <div className="my-4 flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
        <ScoreRing value={overall} size={56} stroke={5} label="Score" />
        <div>
          <p className="text-sm font-medium text-foreground">Live hospitality score</p>
          <p className="text-xs text-muted-foreground">Auto-calculated from all checklist items (1–5).</p>
        </div>
      </div>

      <div className="space-y-4">
        {CATS.map((cat) => (
          <div key={cat} className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="mb-2 flex items-center gap-2">
              <ConciergeBell className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{HOSPITALITY_CHECKLISTS[cat].label}</p>
            </div>
            <div className="space-y-1.5">
              {HOSPITALITY_CHECKLISTS[cat].items.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground/80">{item.label}</span>
                  <ScoreSelect value={scores[cat][item.key]} onChange={(v) => setScore(cat, item.key, v)} />
                </div>
              ))}
            </div>
          </div>
        ))}
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
