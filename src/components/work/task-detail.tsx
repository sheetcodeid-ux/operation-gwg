"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarDays, Layers, Loader2, MapPin, Pencil, Store, Tag, Trash2, User, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { PRIORITY_META, TASK_STATUS_META } from "@/lib/constants";
import { deleteTaskAction } from "@/lib/actions/work";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogTrigger, useDialogControl } from "@/components/ui/dialog";
import { TaskSheet, type DivisionMembers, type TaskOutlet } from "./task-sheet";
import { divisionLabel } from "./division-filter";
import type { WorkRow } from "./work-table";

interface EditProps {
  outlets?: TaskOutlet[];
  coordinators?: { id: string; name: string }[];
  members?: DivisionMembers;
  divisions?: string[];
  canEdit?: boolean;
  isAdmin?: boolean;
  userDepartment?: string;
  categories?: Record<string, string[]>;
}

/** Clickable wrapper: renders `trigger`, opens a centered task-detail dialog (with optional Edit). */
export function TaskDetailDialog({ task, trigger, outlets, coordinators, members, divisions, canEdit, isAdmin, userDepartment, categories }: { task: WorkRow; trigger: React.ReactElement } & EditProps) {
  return (
    <Dialog>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent title={task.title} description={`${task.outlet} · ${task.area}`} align="center" className="max-w-md">
        <TaskDetail task={task} outlets={outlets} coordinators={coordinators} members={members} divisions={divisions} canEdit={canEdit} isAdmin={isAdmin} userDepartment={userDepartment} categories={categories} />
      </DialogContent>
    </Dialog>
  );
}

export function TaskDetail({ task, outlets, coordinators, members, divisions, canEdit, isAdmin, userDepartment, categories }: { task: WorkRow } & EditProps) {
  const router = useRouter();
  const { setOpen } = useDialogControl();
  const [pending, startTransition] = React.useTransition();
  const [confirming, setConfirming] = React.useState(false);
  const duration = Math.max(0, Math.round((+new Date(task.dueDate) - +new Date(task.startDate)) / 86_400_000));
  const progressTone = task.progress >= 100 ? "success" : task.progress > 0 ? "cyan" : "neutral";

  function del() {
    startTransition(async () => {
      const res = await deleteTaskAction(task.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Task deleted");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={TASK_STATUS_META[task.status].tone} dot>
          {TASK_STATUS_META[task.status].label}
        </Badge>
        <Badge tone={PRIORITY_META[task.priority].tone}>{PRIORITY_META[task.priority].label} priority</Badge>
      </div>

      {task.description && (
        <p className="rounded-xl border border-border bg-muted/20 p-3 text-sm leading-relaxed text-foreground/90">
          {task.description}
        </p>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-semibold tabular-nums text-foreground">{task.progress}%</span>
        </div>
        <Progress value={task.progress} tone={progressTone} />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <DetailTile icon={Layers} label="Division" value={divisionLabel(task.division)} />
        <DetailTile icon={Store} label="Outlet" value={task.outlet} />
        <DetailTile icon={MapPin} label="Area" value={task.area} />
        <DetailTile icon={Tag} label="Category" value={task.category} />
        <DetailTile icon={User} label="Person in Charge" value={task.pic} />
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="grid grid-cols-3 items-center">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="size-3.5" /> Start
            </p>
            <p className="mt-1 font-medium text-foreground">{formatDate(task.startDate)}</p>
          </div>
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 border-t border-dashed border-border" />
            <span className="relative inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-foreground shadow-sm">
              <CalendarClock className="size-3" />
              {duration} hari
            </span>
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              Due <CalendarDays className="size-3.5" />
            </p>
            <p className="mt-1 font-medium text-foreground">{formatDate(task.dueDate)}</p>
          </div>
        </div>
      </div>

      {canEdit && outlets && coordinators && (
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Delete task?</span>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                Cancel
              </Button>
              <Button size="sm" onClick={del} disabled={pending} className="bg-red-600 text-white hover:bg-red-700">
                {pending && <Loader2 className="size-3.5 animate-spin" />} Delete
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirming(true)}
              className="text-red-500 hover:bg-red-500/10 hover:text-red-500"
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          )}
          <TaskSheet
            task={{
              id: task.id,
              title: task.title,
              description: task.description,
              category: task.category,
              priority: task.priority,
              status: task.status,
              division: task.division,
              outletId: task.outletId || null,
              picIds: task.picIds,
              start: task.startDate,
              due: task.dueDate,
              progress: task.progress,
            }}
            outlets={outlets}
            coordinators={coordinators}
            members={members}
            divisions={divisions}
            isAdmin={isAdmin}
            userDepartment={userDepartment}
            categories={categories}
            trigger={
              <Button size="sm">
                <Pencil className="size-3.5" /> Edit Task
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
