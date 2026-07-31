"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can, canAccessOutlet } from "@/lib/rbac";
import { getOutlet, getOutlets } from "@/lib/data/store";
import { createTask, deleteTask, updateTask, updateTaskStatus } from "@/lib/data/mutations";
import { addTaskCategory, deleteTaskCategory } from "@/lib/data/task-categories";
import { persistMessage } from "@/lib/data/persist";
import { DEMO_NOW_ISO } from "@/lib/now";
import { parseInput, taskInputSchema, taskStatusSchema } from "@/lib/validation";
import type { Priority, TaskStatus } from "@/lib/types";

export interface TaskInput {
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  division: string;
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
  const parsed = parseInput(taskInputSchema, input);
  if ("error" in parsed) return { error: parsed.error };
  const clean = parsed.data;
  if (clean.outletId && !canAccessOutlet(user, clean.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  const outlet = clean.outletId ? getOutlet(clean.outletId) : null;
  let record;
  try {
    record = await createTask({
      title: clean.title,
      description: clean.description,
      category: clean.category,
      priority: clean.priority,
      status: clean.status,
      division: clean.division,
      outletId: clean.outletId,
      picIds: clean.picIds,
      picId: clean.picIds[0] ?? outlet?.picId ?? user.id,
      startDate: clean.startDate || DEMO_NOW_ISO,
      dueDate: clean.dueDate || DEMO_NOW_ISO,
      progress: clean.progress,
    });
  } catch (e) {
    return { error: persistMessage(e) };
  }

  revalidatePath("/work-tracker");
  revalidatePath("/work-tracker/kanban");
  revalidatePath("/dashboard");
  return { ok: true, id: record.id };
}

export async function updateTaskAction(id: string, input: TaskInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_work_task")) return { error: "You don't have permission to edit tasks." };
  const parsed = parseInput(taskInputSchema, input);
  if ("error" in parsed) return { error: parsed.error };
  const clean = parsed.data;
  if (clean.outletId && !canAccessOutlet(user, clean.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  const outlet = clean.outletId ? getOutlet(clean.outletId) : null;
  updateTask(id, {
    title: clean.title,
    description: clean.description,
    category: clean.category,
    priority: clean.priority,
    status: clean.status,
    division: clean.division,
    outletId: clean.outletId,
    picIds: clean.picIds,
    picId: clean.picIds[0] ?? outlet?.picId ?? user.id,
    startDate: clean.startDate || DEMO_NOW_ISO,
    dueDate: clean.dueDate || DEMO_NOW_ISO,
    progress: clean.progress,
  });

  revalidatePath("/work-tracker");
  revalidatePath("/work-tracker/kanban");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteTaskAction(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_work_task")) return { error: "You don't have permission to delete tasks." };
  deleteTask(id);
  revalidatePath("/work-tracker");
  revalidatePath("/work-tracker/kanban");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateTaskStatusAction(id: string, status: TaskStatus, progress?: number) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_work_task")) return { error: "No permission" };
  if (!taskStatusSchema.safeParse(status).success) return { error: "Invalid status." };
  updateTaskStatus(id, status, progress === undefined ? undefined : Math.max(0, Math.min(100, progress)));
  revalidatePath("/work-tracker");
  revalidatePath("/work-tracker/kanban");
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ---- Per-department categories (Super Admin manages the custom lists) ---- */

export async function addTaskCategoryAction(department: string, name: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "super_admin") return { error: "Hanya Super Admin yang dapat mengelola kategori." };
  const res = await addTaskCategory(department, name);
  if (res.error) return { error: res.error };
  revalidatePath("/work-tracker");
  return { ok: true };
}

export async function deleteTaskCategoryAction(department: string, name: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "super_admin") return { error: "Hanya Super Admin yang dapat mengelola kategori." };
  const res = await deleteTaskCategory(department, name);
  if (res.error) return { error: res.error };
  revalidatePath("/work-tracker");
  return { ok: true };
}
