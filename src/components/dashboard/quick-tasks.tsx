"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Circle,
  Eye,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Store,
  Tag,
  User,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { PRIORITY_META, TASK_STATUS_META } from "@/lib/constants";
import type { Priority, Role, TaskStatus } from "@/lib/types";
import { updateTaskStatusAction } from "@/lib/actions/work";
import { cn, formatDate } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { TaskSheet, type DivisionMembers, type TaskOutlet } from "@/components/work/task-sheet";

export interface QuickTaskItem {
  id: string;
  title: string;
  description: string;
  division: Role;
  outletId: string;
  outlet: string;
  coordinator: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  start: string;
  due: string;
  progress: number;
  picIds: string[];
  pic: string;
  done: boolean;
}

export function QuickTasks({
  tasks,
  canAdd,
  outlets,
  coordinators,
  members,
}: {
  tasks: QuickTaskItem[];
  canAdd: boolean;
  outlets: TaskOutlet[];
  coordinators: { id: string; name: string }[];
  members?: DivisionMembers;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"active" | "completed">("active");
  const [query, setQuery] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const q = query.trim().toLowerCase();
  const filtered = q ? tasks.filter((t) => t.coordinator.toLowerCase().includes(q)) : tasks;
  const active = filtered.filter((t) => !t.done);
  const completed = filtered.filter((t) => t.done);
  const list = tab === "active" ? active : completed;

  function toggle(id: string, done: boolean) {
    startTransition(async () => {
      await updateTaskStatusAction(id, done ? "open" : "done");
      router.refresh();
    });
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Quick Tasks</CardTitle>
          <CardDescription>Manage your daily tasks</CardDescription>
        </div>
        {canAdd && outlets.length > 0 && (
          <TaskSheet
            outlets={outlets}
            coordinators={coordinators}
            members={members}
            trigger={
              <Button size="sm">
                <Plus /> New Task
              </Button>
            }
          />
        )}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
        <SegmentedTabs
          value={tab}
          onChange={(v) => setTab(v as "active" | "completed")}
          items={[
            { value: "active", label: `Active (${active.length})` },
            { value: "completed", label: `Completed (${completed.length})` },
          ]}
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search coordinator areaâ€¦"
            className="pl-9"
          />
        </div>

        {/* absolute scroll area so the (long) list fills the card height without dictating it */}
        <div className="relative min-h-[16rem] flex-1">
          <div className="no-scrollbar absolute inset-0 space-y-1.5 overflow-y-auto">
            {list.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <ListTodo className="size-6 opacity-40" />
                No {tab} tasks
              </div>
            ) : (
              list.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <button
                    type="button"
                    onClick={() => toggle(t.id, t.done)}
                    disabled={pending}
                    aria-label={t.done ? "Reopen task" : "Complete task"}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                  >
                    {t.done ? <CheckCircle2 className="size-5 text-emerald-500" /> : <Circle className="size-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium text-foreground", t.done && "text-muted-foreground line-through")}>
                      {t.title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {t.outlet} Â· {t.coordinator}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Dialog>
                      <DialogTrigger>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Eye className="size-3.5" /> View
                        </button>
                      </DialogTrigger>
                      <DialogContent
                        title={t.title}
                        description={`${t.outlet} Â· ${t.coordinator}`}
                        align="center"
                        className="max-w-md"
                      >
                        <TaskDetail task={t} />
                      </DialogContent>
                    </Dialog>
                    {canAdd && (
                      <TaskSheet
                        task={t}
                        outlets={outlets}
                        coordinators={coordinators}
                        members={members}
                        trigger={
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="size-3.5" /> Edit
                          </button>
                        }
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskDetail({ task }: { task: QuickTaskItem }) {
  const duration = Math.max(0, Math.round((+new Date(task.due) - +new Date(task.start)) / 86_400_000));
  const progressTone = task.progress >= 100 ? "success" : task.progress > 0 ? "cyan" : "neutral";

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={TASK_STATUS_META[task.status].tone}>{TASK_STATUS_META[task.status].label}</Badge>
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
        <DetailTile icon={Store} label="Outlet" value={task.outlet} />
        <DetailTile icon={UserCog} label="Coordinator Area" value={task.coordinator} />
        <DetailTile icon={Tag} label="Category" value={task.category} />
        <DetailTile icon={User} label="Person in Charge" value={task.pic} />
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="grid grid-cols-3 items-center">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              <CalendarDays className="size-3.5" /> Start
            </p>
            <p className="mt-1 font-medium text-foreground">{formatDate(task.start)}</p>
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
            <p className="mt-1 font-medium text-foreground">{formatDate(task.due)}</p>
          </div>
        </div>
      </div>
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
