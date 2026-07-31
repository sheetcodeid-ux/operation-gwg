"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskSheet, type DivisionMembers, type TaskOutlet } from "@/components/work/task-sheet";

export function NewTaskButton({
  outlets,
  coordinators,
  members,
  divisions,
  defaultDivision,
  isAdmin,
  userDepartment,
  categories,
}: {
  outlets: TaskOutlet[];
  coordinators: { id: string; name: string }[];
  members?: DivisionMembers;
  divisions?: string[];
  defaultDivision?: string;
  isAdmin?: boolean;
  userDepartment?: string;
  categories?: Record<string, string[]>;
}) {
  return (
    <TaskSheet
      outlets={outlets}
      coordinators={coordinators}
      members={members}
      divisions={divisions}
      defaultDivision={defaultDivision}
      isAdmin={isAdmin}
      userDepartment={userDepartment}
      categories={categories}
      trigger={
        <Button size="sm">
          <Plus /> New Task
        </Button>
      }
    />
  );
}
