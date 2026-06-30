import { CalendarRange } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { NewEventButton } from "@/components/events/new-event";
import { EventNav } from "@/components/events/event-nav";
import { EventTimelineView } from "@/components/events/event-timeline";
import { buildEventFormData, buildEventRows } from "@/components/events/event-data";

export const metadata: Metadata = { title: "Event Tracker · Timeline" };

export default async function EventTimelinePage() {
  const user = (await getSessionUser())!;
  const rows = buildEventRows(user);
  const form = buildEventFormData(user);
  const canCreate = can(user, "create_event");

  return (
    <div className="w-full">
      <PageHeader
        icon={CalendarRange}
        title="Event Tracker"
        description="Schedule overview across all events — synced with the table and kanban"
        actions={canCreate && form.outlets.length > 0 ? <NewEventButton outlets={form.outlets} coordinators={form.coordinators} /> : undefined}
      />

      <EventNav />

      <div className="mt-4">
        <EventTimelineView rows={rows} outlets={form.outlets} coordinators={form.coordinators} canEdit={canCreate} />
      </div>
    </div>
  );
}
