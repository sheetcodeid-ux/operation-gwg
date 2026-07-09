"use client";

import type { Role } from "@/lib/types";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskSheet, type DivisionMembers, type TaskOutlet } from "@/components/work/task-sheet";

export function NewTaskButton({
  outlets,
  coordinators,
  members,
  defaultDivision,
}: {
  outlets: TaskOutlet[];
  coordinators: { id: string; name: string }[];
  members?: DivisionMembers;
  defaultDivision?: Role;
}) {
  return (
    <TaskSheet
      outlets={outlets}
      coordinators={coordinators}
      members={members}
      defaultDivision={defaultDivision}
      trigger={
        <Button size="sm">
          <Plus /> New Task
        </Button>
      }
    />
  );
}
