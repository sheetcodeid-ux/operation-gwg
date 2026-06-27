"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can, canAccessOutlet } from "@/lib/rbac";
import { getOutlet, getOutlets } from "@/lib/data/store";
import { createTask, deleteTask, updateTask, updateTaskStatus } from "@/lib/data/mutations";
import type { Priority, Role, TaskStatus } from "@/lib/types";

export interface TaskInput {
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  division: Role;
  /** null = division/HQ task with no branch. */
  outletId: string | null;
  /** Manually-picked PIC user ids (1 or many). */
  picIds: string[];
  startDate: string;
  dueDate: string;
  progress: number;
}

export async function createTaskAction(input: TaskInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_work_task")) return { error: "You don't have permission to create tasks." };
  if (!input.title.trim()) return { error: "Task title is required." };
  if (input.outletId && !canAccessOutlet(user, input.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  const outlet = input.outletId ? getOutlet(input.outletId) : null;
  const record = createTask({
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    priority: input.priority,
    status: input.status,
    division: input.division,
    outletId: input.outletId,
    picIds: input.picIds,
    picId: input.picIds[0] ?? outlet?.picId ?? user.id,
    startDate: input.startDate || new Date().toISOString(),
    dueDate: input.dueDate || new Date().toISOString(),
    progress: Math.max(0, Math.min(100, input.progress)),
  });

  revalidatePath("/work-tracker");
  revalidatePath("/dashboard");
  return { ok: true, id: record.id };
}

export async function updateTaskAction(id: string, input: TaskInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_work_task")) return { error: "You don't have permission to edit tasks." };
  if (!input.title.trim()) return { error: "Task title is required." };
  if (input.outletId && !canAccessOutlet(user, input.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  const outlet = input.outletId ? getOutlet(input.outletId) : null;
  updateTask(id, {
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    priority: input.priority,
    status: input.status,
    division: input.division,
    outletId: input.outletId,
    picIds: input.picIds,
    picId: input.picIds[0] ?? outlet?.picId ?? user.id,
    startDate: input.startDate || new Date().toISOString(),
    dueDate: input.dueDate || new Date().toISOString(),
    progress: Math.max(0, Math.min(100, input.progress)),
  });

  revalidatePath("/work-tracker");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteTaskAction(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_work_task")) return { error: "You don't have permission to delete tasks." };
  deleteTask(id);
  revalidatePath("/work-tracker");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateTaskStatusAction(id: string, status: TaskStatus, progress?: number) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_work_task")) return { error: "No permission" };
  updateTaskStatus(id, status, progress);
  revalidatePath("/work-tracker");
  revalidatePath("/dashboard");
  return { ok: true };
}
