import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { NewTaskButton } from "@/components/work/new-task-button";
import { WorkTrackerViews } from "@/components/work/work-tracker-views";
import { buildTaskSheetData, buildWorkRows } from "@/components/work/work-data";

export const metadata: Metadata = { title: "Work Tracker" };

export default async function WorkTrackerPage() {
  const user = (await getSessionUser())!;
  const rows = buildWorkRows(user);
  const sheet = await buildTaskSheetData(user);
  const canCreate = can(user, "create_work_task");

  return (
    <div className="w-full">
      <PageHeader
        icon={ListChecks}
        title="Work Tracker"
        description={sheet.isAdmin ? "Semua tugas per departemen — prioritas, status, dan progres" : `Tugas departemen ${sheet.userDepartment} — prioritas, status, dan progres`}
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
        initialView="table"
      />
    </div>
  );
}
