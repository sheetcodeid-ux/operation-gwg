import { CircleCheck, CircleDot, ListChecks, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { listTasks, outletName, userName, visibleOutlets } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { NewTaskButton } from "@/components/work/new-task";
import { WorkTable, type WorkRow } from "@/components/work/work-table";
import { isOverdue } from "@/lib/utils";

export const metadata: Metadata = { title: "Work Tracker" };

export default async function WorkTrackerPage() {
  const user = (await getSessionUser())!;
  const tasks = listTasks(user);
  const outlets = visibleOutlets(user).map((o) => ({ id: o.id, name: o.name }));
  const canCreate = can(user, "create_work_task");

  const done = tasks.filter((t) => t.status === "done").length;
  const ongoing = tasks.filter((t) => t.status === "ongoing").length;
  const overdue = tasks.filter(
    (t) => isOverdue(t.dueDate) && t.status !== "done" && t.status !== "cancelled",
  ).length;
  const completion = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const rows: WorkRow[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    category: t.category,
    priority: t.priority,
    status: t.status,
    outlet: outletName(t.outletId),
    pic: userName(t.picId),
    dueDate: t.dueDate,
    progress: t.progress,
  }));

  return (
    <div className="w-full">
      <PageHeader
        icon={ListChecks}
        title="Work Tracker"
        description="Operational tasks across your outlets — priority, status and progress"
        actions={canCreate && outlets.length > 0 ? <NewTaskButton outlets={outlets} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={ListChecks} label="Total Tasks" value={tasks.length} tone="brand" />
        <StatTile icon={CircleDot} label="Ongoing" value={ongoing} tone="cyan" />
        <StatTile icon={CircleCheck} label="Completion Rate" value={`${completion}%`} tone="success" />
        <StatTile icon={TriangleAlert} label="Overdue" value={overdue} tone="danger" />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>All Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
