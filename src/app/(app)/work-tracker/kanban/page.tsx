import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NewTaskButton } from "@/components/work/new-task-button";
import { KanbanBoard } from "@/components/work/kanban-board";
import { WorkViews } from "@/components/work/work-views";
import { buildTaskSheetData, buildWorkRows } from "@/components/work/work-data";

export const metadata: Metadata = { title: "Work Tracker · Kanban" };

export default async function WorkKanbanPage() {
  const user = (await getSessionUser())!;
  const rows = buildWorkRows(user);
  const sheet = buildTaskSheetData(user);
  const canCreate = can(user, "create_work_task");

  return (
    <div className="w-full">
      <PageHeader
        icon={ListChecks}
        title="Work Tracker"
        description="Drag tasks between columns to update their status — synced with the table and calendar"
        actions={
          canCreate && sheet.outlets.length > 0 ? (
            <NewTaskButton outlets={sheet.outlets} coordinators={sheet.coordinators} members={sheet.members} />
          ) : undefined
        }
      />

      <WorkViews />

      <Card className="mt-4">
        <CardContent className="pt-5">
          <KanbanBoard rows={rows} outlets={sheet.outlets} coordinators={sheet.coordinators} members={sheet.members} canEdit={canCreate} />
        </CardContent>
      </Card>
    </div>
  );
}
