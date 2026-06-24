"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { EVENT_MILESTONES, EVENT_STATUS_META } from "@/lib/constants";
import type { EventMilestone, EventStatus } from "@/lib/types";
import { createEventAction } from "@/lib/actions/events";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, useDialogControl } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";

const STATUSES = Object.keys(EVENT_STATUS_META) as EventStatus[];

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function NewEventButton({ outlets }: { outlets: { id: string; name: string }[] }) {
  return (
    <Dialog>
      <DialogTrigger>
        <Button size="sm">
          <Plus /> New Event
        </Button>
      </DialogTrigger>
      <DialogContent title="New Event" description="Plan and track a branch event through its milestones." className="max-w-xl">
        <EventForm outlets={outlets} />
      </DialogContent>
    </Dialog>
  );
}

function EventForm({ outlets }: { outlets: { id: string; name: string }[] }) {
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    outletId: outlets[0]?.id ?? "",
    description: "",
    budget: 10_000_000,
    startDate: todayISO(),
    endDate: todayISO(14),
    milestone: "planning" as EventMilestone,
    status: "upcoming" as EventStatus,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit() {
    if (!form.name.trim()) return toast.error("Event name is required.");
    startTransition(async () => {
      const res = await createEventAction({
        ...form,
        budget: Number(form.budget),
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Event created");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
      <Field label="Event Name">
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Grand Opening Promo" />
      </Field>
      <Field label="Description">
        <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Event details…" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Outlet">
          <Select value={form.outletId} onChange={(e) => set("outletId", e.target.value)}>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Budget (IDR)">
          <Input type="number" value={form.budget} onChange={(e) => set("budget", Number(e.target.value) as never)} min={0} step={1_000_000} />
        </Field>
        <Field label="Start Date">
          <Input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </Field>
        <Field label="End Date">
          <Input type="date" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
        </Field>
        <Field label="Milestone">
          <Select value={form.milestone} onChange={(e) => set("milestone", e.target.value as EventMilestone)}>
            {EVENT_MILESTONES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status">
          <Select value={form.status} onChange={(e) => set("status", e.target.value as EventStatus)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {EVENT_STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Create Event
        </Button>
      </div>
    </div>
  );
}
