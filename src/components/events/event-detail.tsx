"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, MapPin, Pencil, Store, Trash2, UserCog, Wallet, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { EVENT_STATUS_META } from "@/lib/constants";
import { deleteEventAction } from "@/lib/actions/events";
import { formatDate, formatIDR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogTrigger, useDialogControl } from "@/components/ui/dialog";
import { MilestoneStepper } from "./milestone-stepper";
import { EventSheet } from "./event-sheet";
import type { EventOutlet } from "./event-data";
import type { EventRow } from "./event-table";

interface EditProps {
  outlets?: EventOutlet[];
  coordinators?: { id: string; name: string }[];
  canEdit?: boolean;
}

export function EventDetailDialog({ event, trigger, outlets, coordinators, canEdit }: { event: EventRow; trigger: React.ReactElement } & EditProps) {
  return (
    <Dialog>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent title={event.name} description={`${event.outlet} · ${event.area}`} align="center" className="max-w-md">
        <EventDetail event={event} outlets={outlets} coordinators={coordinators} canEdit={canEdit} />
      </DialogContent>
    </Dialog>
  );
}

export function EventDetail({ event, outlets, coordinators, canEdit }: { event: EventRow } & EditProps) {
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, startTransition] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);
  const duration = Math.max(0, Math.round((+new Date(event.endDate) - +new Date(event.startDate)) / 86_400_000));

  function del() {
    startTransition(async () => {
      const res = await deleteEventAction(event.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Event deleted");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={EVENT_STATUS_META[event.status].tone} dot>
          {EVENT_STATUS_META[event.status].label}
        </Badge>
      </div>

      {event.description && (
        <p className="rounded-xl border border-border bg-muted/20 p-3 text-sm leading-relaxed text-foreground/90">{event.description}</p>
      )}

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <MilestoneStepper current={event.milestone} />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-semibold tabular-nums text-foreground">{event.progress}%</span>
        </div>
        <Progress value={event.progress} tone={event.progress >= 100 ? "success" : "brand"} />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <DetailTile icon={Store} label="Outlet" value={event.outlet} />
        <DetailTile icon={MapPin} label="Area" value={event.area} />
        <DetailTile icon={UserCog} label="Coordinator Area" value={event.pic} />
        <DetailTile icon={Wallet} label="Budget" value={formatIDR(event.budget)} />
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="grid grid-cols-3 items-center">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="size-3.5" /> Start
            </p>
            <p className="mt-1 font-medium text-foreground">{formatDate(event.startDate)}</p>
          </div>
          <div className="text-center text-[11px] font-medium text-muted-foreground">{duration} hari</div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              End <CalendarDays className="size-3.5" />
            </p>
            <p className="mt-1 font-medium text-foreground">{formatDate(event.endDate)}</p>
          </div>
        </div>
      </div>

      {canEdit && outlets && coordinators && (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Delete event?</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                Cancel
              </Button>
              <Button size="sm" onClick={del} disabled={pending} className="bg-red-600 text-white hover:bg-red-700">
                {pending && <Loader2 className="size-3.5 animate-spin" />} Delete
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} className="text-red-500 hover:bg-red-500/10 hover:text-red-500">
              <Trash2 className="size-3.5" /> Delete
            </Button>
          )}
          <EventSheet
            event={{
              id: event.id,
              name: event.name,
              description: event.description,
              outletId: event.outletId,
              picId: event.picId,
              budget: event.budget,
              start: event.startDate,
              end: event.endDate,
              milestone: event.milestone,
              status: event.status,
            }}
            outlets={outlets}
            coordinators={coordinators}
            trigger={
              <Button size="sm">
                <Pencil className="size-3.5" /> Edit Event
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}

function DetailTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/20 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
