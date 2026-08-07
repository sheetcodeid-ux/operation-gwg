import { CalendarRange } from "lucide-react";
import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { NewEventButton } from "@/components/events/new-event";
import { EventNav } from "@/components/events/event-nav";
import { EventKanban } from "@/components/events/event-kanban";
import { buildEventFormData, buildEventRows } from "@/components/events/event-data";

export const metadata: Metadata = { title: "Event Tracker · Kanban" };

export default async function EventKanbanPage() {
  const user = await requireSessionUser();
  const rows = buildEventRows(user);
  const form = buildEventFormData(user);
  const canCreate = can(user, "create_event");

  return (
    <div className="w-full">
      <PageHeader
        icon={CalendarRange}
        title="Event Tracker"
        description="Drag events between milestones — planning, preparation, execution, evaluation"
        actions={canCreate && form.outlets.length > 0 ? <NewEventButton outlets={form.outlets} coordinators={form.coordinators} /> : undefined}
      />

      <EventNav />

      <Card className="mt-4">
        <CardContent className="pt-5">
          <EventKanban rows={rows} outlets={form.outlets} coordinators={form.coordinators} canEdit={canCreate} />
        </CardContent>
      </Card>
    </div>
  );
}
