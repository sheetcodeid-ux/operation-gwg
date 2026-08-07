import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { NewTaskButton } from "@/components/work/new-task-button";
import { WorkTrackerViews } from "@/components/work/work-tracker-views";
import { buildTaskSheetData, buildWorkRows } from "@/components/work/work-data";

export const metadata: Metadata = { title: "Work Tracker" };

export default async function WorkTrackerPage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const user = await requireSessionUser();
  const sp = await searchParams;
  const rows = buildWorkRows(user);
  const sheet = await buildTaskSheetData(user);
  const canCreate = can(user, "create_work_task");

  // Super Admin entering a specific department's sidebar section (?dept=…) →
  // open pre-scoped to that department (filter default + create default).
  const dept = sheet.isAdmin && sp.dept && sheet.divisions.includes(sp.dept) ? sp.dept : undefined;
  const headerDept = dept ?? (sheet.isAdmin ? null : sheet.userDepartment);
  const createDept = dept ?? sheet.defaultDivision;

  return (
    <div className="w-full">
      <PageHeader
        icon={ListChecks}
        title="Work Tracker"
        description={headerDept ? `Tugas departemen ${headerDept} — prioritas, status, dan progres` : "Semua tugas per departemen — prioritas, status, dan progres"}
        actions={
          canCreate ? (
            <NewTaskButton
              outlets={sheet.outlets}
              coordinators={sheet.coordinators}
              members={sheet.members}
              divisions={sheet.divisions}
              defaultDivision={createDept}
              isAdmin={sheet.isAdmin}
              userDepartment={dept ?? sheet.userDepartment}
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
        initialDivision={dept ?? "all"}
        initialView="table"
      />
    </div>
  );
}
