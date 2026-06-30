import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { NewTaskButton } from "@/components/work/new-task-button";
import { WorkTable } from "@/components/work/work-table";
import { WorkViews } from "@/components/work/work-views";
import { buildTaskSheetData, buildWorkRows } from "@/components/work/work-data";

export const metadata: Metadata = { title: "Work Tracker" };

export default async function WorkTrackerPage() {
  const user = (await getSessionUser())!;
  const rows = buildWorkRows(user);
  const sheet = buildTaskSheetData(user);
  const canCreate = can(user, "create_work_task");

  return (
    <div className="w-full">
      <PageHeader
        icon={ListChecks}
        title="Work Tracker"
        description="Operational tasks across your outlets — priority, status and progress"
        actions={
          canCreate && sheet.outlets.length > 0 ? (
            <NewTaskButton outlets={sheet.outlets} coordinators={sheet.coordinators} members={sheet.members} />
          ) : undefined
        }
      />

      <WorkViews />

      <div className="mt-4">
        <WorkTable rows={rows} outlets={sheet.outlets} coordinators={sheet.coordinators} members={sheet.members} canEdit={canCreate} />
      </div>
    </div>
  );
}
