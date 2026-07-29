"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PRIORITY_META, TASK_STATUS_META, WORK_CATEGORIES } from "@/lib/constants";
import type { Priority, TaskStatus } from "@/lib/types";
import { createTaskAction, updateTaskAction } from "@/lib/actions/work";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, useSheetControl } from "@/components/ui/sheet";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { MultiCombobox, SelectionChips } from "@/components/ui/multi-combobox";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { divisionLabel } from "./division-filter";

export interface TaskOutlet {
  id: string;
  name: string;
  coordinatorId: string | null;
}

export interface EditableTask {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  division: string;
  outletId: string | null;
  picIds: string[];
  start: string;
  due: string;
  progress: number;
}

const PRIORITIES = Object.keys(PRIORITY_META) as Priority[];
const STATUSES = Object.keys(TASK_STATUS_META) as TaskStatus[];

/** Default date for a NEW task's Start/Due fields — the REAL current date (local
 *  time), so a new task always lands in the running month and automatically
 *  rolls into the next month/year as time passes (no more being stuck in a past
 *  month). Local Y-M-D avoids a UTC off-by-one at the edges of the day. */
function defaultDateISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateInput(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(+d) ? defaultDateISO() : d.toISOString().slice(0, 10);
}

/** Slide-in (Sheet) task form — create or edit, by division, with optional branch. Shared by Dashboard + Work Tracker. */
export type DivisionMembers = Record<string, { id: string; name: string }[]>;

export function TaskSheet({
  trigger,
  task,
  outlets,
  members,
  divisions,
  defaultDivision,
}: {
  trigger: React.ReactElement;
  task?: EditableTask;
  outlets: TaskOutlet[];
  members?: DivisionMembers;
  divisions?: string[];
  defaultDivision?: string;
  /** Accepted for back-compat; no longer used (assignment is by division). */
  coordinators?: { id: string; name: string }[];
}) {
  return (
    <Sheet>
      <SheetTrigger>{trigger}</SheetTrigger>
      <SheetContent
        title={task ? "Edit Task" : "New Work Task"}
        description={task ? "Update this task." : "Create a task by division — with or without a branch."}
        className="max-w-lg"
      >
        <TaskForm task={task} outlets={outlets} members={members} divisions={divisions} defaultDivision={defaultDivision} />
      </SheetContent>
    </Sheet>
  );
}

function TaskForm({
  task,
  outlets,
  members,
  divisions = [],
  defaultDivision,
}: {
  task?: EditableTask;
  outlets: TaskOutlet[];
  members?: DivisionMembers;
  divisions?: string[];
  defaultDivision?: string;
}) {
  const router = useRouter();
  const { setOpen } = useSheetControl();
  const [pending, startTransition] = React.useTransition();
  const [branch, setBranch] = React.useState<boolean>(!!task?.outletId);
  const [form, setForm] = React.useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    category: task?.category ?? (WORK_CATEGORIES[0] as string),
    priority: task?.priority ?? ("medium" as Priority),
    status: task?.status ?? ("open" as TaskStatus),
    division: task?.division ?? defaultDivision ?? divisions[0] ?? "",
    outletId: task?.outletId ?? outlets[0]?.id ?? "",
    picIds: task?.picIds ?? [],
    startDate: task ? toDateInput(task.start) : defaultDateISO(),
    dueDate: task ? toDateInput(task.due) : defaultDateISO(7),
    progress: task?.progress ?? 0,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function pickDivision(v: string) {
    // Reset PIC selection because members differ per division (keep any still valid).
    const next = members?.[v] ?? [];
    const validIds = new Set(next.map((m) => m.id));
    setForm((f) => ({ ...f, division: v, picIds: f.picIds.filter((id) => validIds.has(id)) }));
  }

  const duration = Math.round((+new Date(form.dueDate) - +new Date(form.startDate)) / 86_400_000);
  const validRange = duration >= 0;
  const divMembers = members?.[form.division] ?? [];
  const picNames = form.picIds.map((id) => divMembers.find((m) => m.id === id)?.name).filter((n): n is string => !!n);

  function submit() {
    if (!form.title.trim()) {
      toast.error("Task title is required.");
      return;
    }
    if (branch && !form.outletId) {
      toast.error("Pilih outlet, atau ganti ke Tanpa Cabang.");
      return;
    }
    if (!validRange) {
      toast.error("Due date must be on or after the start date.");
      return;
    }
    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      priority: form.priority,
      status: form.status,
      division: form.division,
      outletId: branch ? form.outletId : null,
      picIds: form.picIds,
      startDate: new Date(form.startDate).toISOString(),
      dueDate: new Date(form.dueDate).toISOString(),
      progress: form.progress,
    };
    startTransition(async () => {
      const res = task ? await updateTaskAction(task.id, payload) : await createTaskAction(payload);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(task ? "Task updated" : "Task created");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <Field label="Task Title">
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. AC service & cleaning" />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Details…" />
        </Field>

        <Field label="Divisi">
          <Combobox
            value={form.division}
            onChange={pickDivision}
            options={divisions.map((d) => ({ value: d, label: divisionLabel(d) }))}
            searchPlaceholder="Cari divisi…"
          />
        </Field>

        <Field label={`PIC · siapa yang mengerjakan (${form.picIds.length})`}>
          {divMembers.length ? (
            <div className="space-y-2">
              <MultiCombobox
                value={form.picIds}
                onChange={(v) => set("picIds", v)}
                options={divMembers.map((m) => ({ value: m.id, label: m.name }))}
                placeholder="Pilih PIC (boleh lebih dari satu)…"
                searchPlaceholder="Cari nama…"
              />
              <SelectionChips labels={picNames} onClear={() => set("picIds", [])} />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
              Belum ada anggota di divisi ini.
            </p>
          )}
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Cabang</p>
          <SegmentedTabs
            value={branch ? "branch" : "none"}
            onChange={(v) => setBranch(v === "branch")}
            items={[
              { value: "none", label: "Tanpa Cabang" },
              { value: "branch", label: "Dengan Cabang" },
            ]}
          />
        </div>

        {branch && (
          <Field label="Outlet">
            <Combobox
              value={form.outletId}
              onChange={(v) => set("outletId", v)}
              options={outlets.map((o) => ({ value: o.id, label: o.name }))}
              placeholder="Pilih outlet"
              searchPlaceholder="Cari outlet…"
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Combobox value={form.category} onChange={(v) => set("category", v)} options={WORK_CATEGORIES.map((c) => ({ value: c, label: c }))} />
          </Field>
          <Field label="Priority">
            <Combobox value={form.priority} onChange={(v) => set("priority", v as Priority)} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))} />
          </Field>
        </div>

        <Field label="Status">
          <Combobox value={form.status} onChange={(v) => set("status", v as TaskStatus)} options={STATUSES.map((s) => ({ value: s, label: TASK_STATUS_META[s].label }))} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal Mulai">
            <DatePicker value={form.startDate} onChange={(v) => set("startDate", v)} />
          </Field>
          <Field label="Tanggal Selesai">
            <DatePicker value={form.dueDate} onChange={(v) => set("dueDate", v)} />
          </Field>
        </div>

        <div
          className={cn(
            "flex items-center justify-between rounded-xl border px-4 py-3",
            validRange ? "border-border bg-muted/30" : "border-red-500/40 bg-red-500/10",
          )}
        >
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="size-4" />
            Durasi pengerjaan
          </span>
          <span className={cn("text-sm font-semibold", validRange ? "text-foreground" : "text-red-500")}>
            {validRange ? `${duration} hari` : "Tanggal tidak valid"}
          </span>
        </div>

        <Field label={`Progress · ${form.progress}%`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={form.progress}
            onChange={(e) => set("progress", Number(e.target.value))}
            className="w-full accent-foreground"
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 border-t border-border p-4">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} {task ? "Save Changes" : "Create Task"}
        </Button>
      </div>
    </>
  );
}
