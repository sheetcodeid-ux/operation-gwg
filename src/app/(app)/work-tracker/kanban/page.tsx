import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { NewTaskButton } from "@/components/work/new-task-button";
import { WorkTrackerViews } from "@/components/work/work-tracker-views";
import { buildTaskSheetData, buildWorkRows } from "@/components/work/work-data";

export const metadata: Metadata = { title: "Work Tracker · Kanban" };

export default async function WorkKanbanPage() {
  const user = (await getSessionUser())!;
  const rows = buildWorkRows(user);
  const sheet = await buildTaskSheetData(user);
  const canCreate = can(user, "create_work_task");

  return (
    <div className="w-full">
      <PageHeader
        icon={ListChecks}
        title="Work Tracker"
        description="Geser tugas antar kolom untuk mengubah statusnya — tersinkron dengan tabel"
        actions={
          canCreate ? (
            <NewTaskButton
              outlets={sheet.outlets}
              coordinators={sheet.coordinators}
              members={sheet.members}
              divisions={sheet.divisions}
              defaultDivision={sheet.defaultDivision}
              isAdmin={sheet.isAdmin}
              userDepartment={sheet.userDepartment}
              categories={sheet.categories}
            />
          ) : undefined
        }
      />

      <WorkTrackerViews
        rows={rows}
        outlets={sheet.outlets}
        coordinators={sheet.coordinators}
        members={sheet.members}
        divisions={sheet.divisions}
        canEdit={canCreate}
        isAdmin={sheet.isAdmin}
        userDepartment={sheet.userDepartment}
        categories={sheet.categories}
        initialView="kanban"
      />
    </div>
  );
}
