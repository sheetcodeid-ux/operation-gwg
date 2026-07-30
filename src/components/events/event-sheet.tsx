"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EVENT_MILESTONES, EVENT_STATUS_META } from "@/lib/constants";
import type { EventMilestone, EventStatus } from "@/lib/types";
import { createEventAction, updateEventAction } from "@/lib/actions/events";
import { DEMO_NOW } from "@/lib/now";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, useSheetControl } from "@/components/ui/sheet";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import type { EventOutlet } from "./event-data";

export interface EditableEvent {
  id: string;
  name: string;
  description: string;
  outletId: string;
  picId: string;
  budget: number;
  start: string;
  end: string;
  milestone: EventMilestone;
  status: EventStatus;
}

const MILESTONES = EVENT_MILESTONES.map((m) => ({ value: m.value, label: m.label }));
const STATUSES = Object.keys(EVENT_STATUS_META) as EventStatus[];

function defaultDateISO(offsetDays = 0) {
  const d = new Date(DEMO_NOW);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
function toDateInput(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(+d) ? defaultDateISO() : d.toISOString().slice(0, 10);
}

/** Slide-in (Sheet) event form — create or edit. PIC = Coordinator Area. */
export function EventSheet({
  trigger,
  event,
  outlets,
  coordinators,
}: {
  trigger: React.ReactElement;
  event?: EditableEvent;
  outlets: EventOutlet[];
  coordinators: { id: string; name: string }[];
}) {
  return (
    <Sheet>
      <SheetTrigger>{trigger}</SheetTrigger>
      <SheetContent
        title={event ? "Edit Event" : "New Event"}
        description={event ? "Update this event." : "Plan and track a branch event through its milestones."}
        className="max-w-lg"
      >
        <EventForm event={event} outlets={outlets} coordinators={coordinators} />
      </SheetContent>
    </Sheet>
  );
}

function EventForm({
  event,
  outlets,
  coordinators,
}: {
  event?: EditableEvent;
  outlets: EventOutlet[];
  coordinators: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { setOpen } = useSheetControl();
  const [pending, startTransition] = React.useTransition();
  const firstOutlet = outlets[0];
  const [form, setForm] = React.useState({
    name: event?.name ?? "",
    description: event?.description ?? "",
    outletId: event?.outletId ?? firstOutlet?.id ?? "",
    picId: event?.picId ?? firstOutlet?.coordinatorId ?? coordinators[0]?.id ?? "",
    budget: event?.budget ?? 10_000_000,
    startDate: event ? toDateInput(event.start) : defaultDateISO(),
    endDate: event ? toDateInput(event.end) : defaultDateISO(14),
    milestone: event?.milestone ?? ("planning" as EventMilestone),
    status: event?.status ?? ("upcoming" as EventStatus),
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Picking an outlet defaults the PIC to that outlet's area coordinator.
  function pickOutlet(v: string) {
    const coord = outlets.find((o) => o.id === v)?.coordinatorId;
    setForm((f) => ({ ...f, outletId: v, picId: coord ?? f.picId }));
  }

  const duration = Math.round((+new Date(form.endDate) - +new Date(form.startDate)) / 86_400_000);
  const validRange = duration >= 0;

  function submit() {
    if (!form.name.trim()) return toast.error("Event name is required.");
    if (!form.outletId) return toast.error("Pilih outlet.");
    if (!validRange) return toast.error("End date must be on or after the start date.");
    const payload = {
      name: form.name,
      outletId: form.outletId,
      picId: form.picId,
      description: form.description,
      budget: Number(form.budget),
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
      milestone: form.milestone,
      status: form.status,
    };
    startTransition(async () => {
      const res = event ? await updateEventAction(event.id, payload) : await createEventAction(payload);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(event ? "Event updated" : "Event created");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <Field label="Event Name">
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Grand Opening Promo" />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Event details…" />
        </Field>

        <Field label="Outlet">
          <Combobox
            value={form.outletId}
            onChange={pickOutlet}
            options={outlets.map((o) => ({ value: o.id, label: o.name }))}
            placeholder="Pilih outlet"
            searchPlaceholder="Cari outlet…"
          />
        </Field>

        <Field label="Coordinator Area (PIC)">
          <Combobox
            value={form.picId}
            onChange={(v) => set("picId", v)}
            options={coordinators.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Pilih coordinator"
            searchPlaceholder="Cari coordinator…"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Budget (IDR)">
            <Input
              inputMode="numeric"
              value={form.budget ? form.budget.toLocaleString("id-ID") : ""}
              onChange={(e) => set("budget", (Number(e.target.value.replace(/\D/g, "")) || 0) as never)}
              placeholder="0"
            />
          </Field>
          <Field label="Status">
            <Combobox
              value={form.status}
              onChange={(v) => set("status", v as EventStatus)}
              options={STATUSES.map((s) => ({ value: s, label: EVENT_STATUS_META[s].label }))}
            />
          </Field>
        </div>

        <Field label="Milestone">
          <Combobox value={form.milestone} onChange={(v) => set("milestone", v as EventMilestone)} options={MILESTONES} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal Mulai">
            <DatePicker value={form.startDate} onChange={(v) => set("startDate", v)} />
          </Field>
          <Field label="Tanggal Selesai">
            <DatePicker value={form.endDate} onChange={(v) => set("endDate", v)} />
          </Field>
        </div>

        <div
          className={cn(
            "flex items-center justify-between rounded-xl border px-4 py-3",
            validRange ? "border-border bg-muted/30" : "border-red-500/40 bg-red-500/10",
          )}
        >
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="size-4" /> Durasi event
          </span>
          <span className={cn("text-sm font-semibold", validRange ? "text-foreground" : "text-red-500")}>
            {validRange ? `${duration} hari` : "Tanggal tidak valid"}
          </span>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-border p-4">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} {event ? "Save Changes" : "Create Event"}
        </Button>
      </div>
    </>
  );
}
