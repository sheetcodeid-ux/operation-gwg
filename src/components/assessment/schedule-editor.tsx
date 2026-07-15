"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { saveAssessmentScheduleAction } from "@/lib/actions/assessment-schedule";
import type { AssessmentSchedule } from "@/lib/data/assessment-schedule";

/** ISO → value for <input type="datetime-local"> in the viewer's local zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

/** Admin control (Super Admin only) to set the assessment window. */
export function ScheduleEditor({ initial }: { initial: AssessmentSchedule }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [startAt, setStartAt] = React.useState(toLocalInput(initial.startAt));
  const [endAt, setEndAt] = React.useState(toLocalInput(initial.endAt));

  function save() {
    start(async () => {
      const res = await saveAssessmentScheduleAction({ startAt: fromLocalInput(startAt), endAt: fromLocalInput(endAt) });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Jadwal assessment disimpan");
      router.refresh();
    });
  }

  const now = Date.now();
  const status = initial.endAt && now > Date.parse(initial.endAt)
    ? { label: "Selesai — hanya Head/Director/Legal", tone: "text-amber-600 dark:text-amber-400" }
    : initial.startAt && now < Date.parse(initial.startAt)
      ? { label: "Belum dibuka", tone: "text-muted-foreground" }
      : { label: "Sedang berlangsung — semua HO bisa akses", tone: "text-emerald-600 dark:text-emerald-400" };

  return (
    <div className="mb-4 rounded-xl border border-border bg-muted/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Jadwal Assessment</p>
        <span className={`ml-auto text-[11px] font-medium ${status.tone}`}>{status.label}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mulai">
          <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </Field>
        <Field label="Selesai">
          <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Aktif: <span className="text-foreground">{fmt(initial.startAt)}</span> → <span className="text-foreground">{fmt(initial.endAt)}</span>. Setelah selesai, hanya Head, Director &amp; Legal yang bisa mengakses.
        </p>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan
        </Button>
      </div>
    </div>
  );
}
