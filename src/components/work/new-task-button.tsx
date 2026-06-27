"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskSheet, type DivisionMembers, type TaskOutlet } from "@/components/work/task-sheet";

export function NewTaskButton({
  outlets,
  coordinators,
  members,
}: {
  outlets: TaskOutlet[];
  coordinators: { id: string; name: string }[];
  members?: DivisionMembers;
}) {
  return (
    <TaskSheet
      outlets={outlets}
      coordinators={coordinators}
      members={members}
      trigger={
        <Button size="sm">
          <Plus /> New Task
        </Button>
      }
    />
  );
}
