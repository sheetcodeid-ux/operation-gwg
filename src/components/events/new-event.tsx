"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventSheet } from "./event-sheet";
import type { EventOutlet } from "./event-data";

/** Client wrapper so the trigger button isn't built in a Server Component. */
export function NewEventButton({
  outlets,
  coordinators,
}: {
  outlets: EventOutlet[];
  coordinators: { id: string; name: string }[];
}) {
  return (
    <EventSheet
      outlets={outlets}
      coordinators={coordinators}
      trigger={
        <Button size="sm">
          <Plus /> New Event
        </Button>
      }
    />
  );
}
