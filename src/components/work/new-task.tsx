"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PRIORITY_META, TASK_STATUS_META, WORK_CATEGORIES } from "@/lib/constants";
import type { Priority, TaskStatus } from "@/lib/types";
import { createTaskAction } from "@/lib/actions/work";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, useDialogControl } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";

const PRIORITIES = Object.keys(PRIORITY_META) as Priority[];
const STATUSES = Object.keys(TASK_STATUS_META) as TaskStatus[];

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function NewTaskButton({ outlets }: { outlets: { id: string; name: string }[] }) {
  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm">
          <Plus /> New Task
        </Button>
      </DialogTrigger>
      <DialogContent title="New Work Task" description="Track an operational task end to end." className="max-w-xl">
        <TaskForm outlets={outlets} />
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({ outlets }: { outlets: { id: string; name: string }[] }) {
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: WORK_CATEGORIES[0] as string,
    priority: "medium" as Priority,
    status: "open" as TaskStatus,
    outletId: outlets[0]?.id ?? "",
    startDate: todayISO(),
    dueDate: todayISO(7),
    progress: 0,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    if (!form.title.trim()) {
      toast.error("Task title is required.");
      return;
    }
    startTransition(async () => {
      const res = await createTaskAction({
        ...form,
        startDate: new Date(form.startDate).toISOString(),
        dueDate: new Date(form.dueDate).toISOString(),
        progress: Number(form.progress),
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Task created");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
      <Field label="Task Title">
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. AC service & cleaning" />
      </Field>
      <Field label="Description">
        <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Details…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Outlet">
          <Combobox
            value={form.outletId}
            onChange={(v) => set("outletId", v)}
            options={outlets.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Select outlet"
            searchPlaceholder="Search outlets…"
          />
        </Field>
        <Field label="Category">
          <Combobox
            value={form.category}
            onChange={(v) => set("category", v)}
            options={WORK_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
        </Field>
        <Field label="Priority">
          <Combobox
            value={form.priority}
            onChange={(v) => set("priority", v as Priority)}
            options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
          />
        </Field>
        <Field label="Status">
          <Combobox
            value={form.status}
            onChange={(v) => set("status", v as TaskStatus)}
            options={STATUSES.map((s) => ({ value: s, label: TASK_STATUS_META[s].label }))}
          />
        </Field>
        <Field label="Start Date">
          <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </Field>
        <Field label="Due Date">
          <Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
        </Field>
      </div>
      <Field label={`Progress · ${form.progress}%`}>
        <input
          type="range"
          min={0}
          max={100}
          value={form.progress}
          onChange={(e) => set("progress", Number(e.target.value) as never)}
          className="w-full accent-brand-500"
        />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Create Task
        </Button>
      </div>
    </div>
  );
}
