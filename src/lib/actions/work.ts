"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can, canAccessOutlet } from "@/lib/rbac";
import { getOutlet, getOutlets } from "@/lib/data/store";
import { createTask, deleteTask, updateTask, updateTaskStatus } from "@/lib/data/mutations";
import { addTaskCategory, deleteTaskCategory } from "@/lib/data/task-categories";
import { persistMessage } from "@/lib/data/persist";
import { getHcRequestByTask, updateHcRequest } from "@/lib/data/hc-requests";
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
  /** Semua cabang yang tersentuh. Satu kerjaan = satu tugas, berapa pun cabangnya. */
  outletIds?: string[];
  /** Brand yang tersentuh (Nordu, Cattu, Busari, Lesung Pipi). */
  brands?: string[];
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
  // Cabang utama = yang dipilih, atau cabang pertama dari daftar.
  const outletIds = clean.outletIds.length ? clean.outletIds : clean.outletId ? [clean.outletId] : [];
  const primaryOutlet = clean.outletId ?? outletIds[0] ?? null;
  const outlets = getOutlets();
  for (const oid of outletIds) {
    if (!canAccessOutlet(user, oid, outlets)) return { error: "Outlet is outside your scope." };
  }

  const outlet = primaryOutlet ? getOutlet(primaryOutlet) : null;
  let record;
  try {
    record = await createTask({
      title: clean.title,
      description: clean.description,
      category: clean.category,
      priority: clean.priority,
      status: clean.status,
      division: clean.division,
      outletId: primaryOutlet,
      outletIds,
      brands: clean.brands,
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
  const editOutletIds = clean.outletIds.length ? clean.outletIds : clean.outletId ? [clean.outletId] : [];
  const editPrimary = clean.outletId ?? editOutletIds[0] ?? null;
  const editOutlets = getOutlets();
  for (const oid of editOutletIds) {
    if (!canAccessOutlet(user, oid, editOutlets)) return { error: "Outlet is outside your scope." };
  }

  const outlet = editPrimary ? getOutlet(editPrimary) : null;
  updateTask(id, {
    title: clean.title,
    description: clean.description,
    category: clean.category,
    priority: clean.priority,
    status: clean.status,
    division: clean.division,
    outletId: editPrimary,
    outletIds: editOutletIds,
    brands: clean.brands,
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

  // Tugas yang lahir dari permintaan design membawa status pengajuannya:
  // menyelesaikan tugas berarti permintaannya juga selesai, supaya pemohon
  // tidak perlu ditanya "sudah jadi belum" lewat jalur lain.
  await syncDesignRequestFromTask(id, status);

  revalidatePath("/work-tracker");
  revalidatePath("/work-tracker/kanban");
  revalidatePath("/dashboard");
  return { ok: true };
}

async function syncDesignRequestFromTask(taskId: string, status: TaskStatus) {
  try {
    const req = await getHcRequestByTask(taskId);
    if (!req || req.kind !== "design") return;
    if (status === "done" && req.status !== "terlaksana") {
      await updateHcRequest(req.id, { status: "terlaksana", completedAt: new Date().toISOString() });
    } else if (status !== "done" && req.status === "terlaksana") {
      // Tugas dibuka kembali ⇒ pengajuannya ikut kembali berjalan.
      await updateHcRequest(req.id, { status: "disetujui_hc", completedAt: null });
    } else {
      return;
    }
    revalidatePath("/creative/design");
    revalidatePath("/pengajuan/design");
    revalidatePath("/pengajuan");
  } catch (e) {
    // Sinkronisasi gagal tidak boleh membatalkan perubahan status tugasnya.
    console.error("[work] gagal menyinkronkan pengajuan design:", e);
  }
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
