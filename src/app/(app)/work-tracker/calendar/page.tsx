import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { NOW } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NewTaskButton } from "@/components/work/new-task-button";
import { CalendarView } from "@/components/work/calendar-view";
import { WorkViews } from "@/components/work/work-views";
import { buildTaskSheetData, buildWorkRows } from "@/components/work/work-data";

export const metadata: Metadata = { title: "Work Tracker · Calendar" };

export default async function WorkCalendarPage() {
  const user = (await getSessionUser())!;
  const rows = buildWorkRows(user);
  const sheet = buildTaskSheetData(user);
  const canCreate = can(user, "create_work_task");

  const ref = new Date(NOW);
  const initialYear = ref.getUTCFullYear();
  const initialMonth = ref.getUTCMonth();
  const todayKey = `${initialYear}-${initialMonth}-${ref.getUTCDate()}`;

  return (
    <div className="w-full">
      <PageHeader
        icon={ListChecks}
        title="Work Tracker"
        description="Tasks placed on their due date — synced with the table and kanban"
        actions={
          canCreate && sheet.outlets.length > 0 ? (
            <NewTaskButton outlets={sheet.outlets} coordinators={sheet.coordinators} members={sheet.members} />
          ) : undefined
        }
      />

      <WorkViews />

      <Card className="mt-4">
        <CardContent className="pt-5">
          <CalendarView
            rows={rows}
            initialYear={initialYear}
            initialMonth={initialMonth}
            todayKey={todayKey}
            outlets={sheet.outlets}
            coordinators={sheet.coordinators}
            members={sheet.members}
            canEdit={canCreate}
          />
        </CardContent>
      </Card>
    </div>
  );
}
