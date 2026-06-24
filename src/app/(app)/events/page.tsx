import { CalendarRange, PlayCircle, Wallet, CheckCheck } from "lucide-react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { listEvents, visibleOutlets } from "@/lib/data/store";
import { can } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { NewEventButton } from "@/components/events/new-event";
import { EventCard, EventTimeline } from "@/components/events/event-views";
import { formatIDR } from "@/lib/utils";

export const metadata: Metadata = { title: "Event Tracker" };

export default async function EventsPage() {
  const user = (await getSessionUser())!;
  const events = listEvents(user);
  const outlets = visibleOutlets(user).map((o) => ({ id: o.id, name: o.name }));
  const canCreate = can(user, "create_event");

  const running = events.filter((e) => e.status === "running").length;
  const finished = events.filter((e) => e.status === "finished").length;
  const totalBudget = events.reduce((a, b) => a + b.budget, 0);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        icon={CalendarRange}
        title="Event Tracker"
        description="Branch events tracked across planning, preparation, execution and evaluation"
        actions={canCreate && outlets.length > 0 ? <NewEventButton outlets={outlets} /> : undefined}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={CalendarRange} label="Total Events" value={events.length} tone="brand" />
        <StatTile icon={PlayCircle} label="Running" value={running} tone="cyan" />
        <StatTile icon={CheckCheck} label="Finished" value={finished} tone="success" />
        <StatTile icon={Wallet} label="Total Budget" value={formatIDR(totalBudget)} tone="amber" />
      </div>

      {events.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="pt-5">
            <EmptyState
              icon={CalendarRange}
              title="No events yet"
              description={canCreate ? "Create an event to start tracking milestones and budget." : "Events will appear here once created."}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Schedule overview across all events</CardDescription>
            </CardHeader>
            <CardContent>
              <EventTimeline events={events} />
            </CardContent>
          </Card>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
