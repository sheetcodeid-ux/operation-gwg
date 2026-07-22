"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can, canAccessOutlet } from "@/lib/rbac";
import { getComplaint, getOutlets } from "@/lib/data/store";
import {
  approveComplaint,
  createComplaint,
  resolveComplaint,
  returnComplaintForRevision,
  submitComplaintForApproval,
} from "@/lib/data/mutations";
import { db, dbEnabled } from "@/lib/data/db";
import { persistMessage } from "@/lib/data/persist";
import { complaintInputSchema, parseInput, resolveComplaintSchema } from "@/lib/validation";
import type {
  ComplaintCategory,
  ComplaintSource,
  ComplaintStatus,
  RootCauseCategory,
} from "@/lib/types";

/** Only the Coordinator Area (and Super Admin as override) may approve. */
function canApproveComplaints(role: string): boolean {
  return role === "area_coordinator" || role === "super_admin";
}

export interface ComplaintInput {
  source: ComplaintSource;
  customerName: string;
  rating?: number | null;
  content: string;
  outletId: string;
  category: ComplaintCategory;
}

export async function createComplaintAction(input: ComplaintInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "manage_complaint")) return { error: "You don't have permission to log complaints." };
  const parsed = parseInput(complaintInputSchema, input);
  if ("error" in parsed) return { error: parsed.error };
  const clean = parsed.data;
  if (!canAccessOutlet(user, clean.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  let record;
  try {
    record = await createComplaint({
      source: clean.source,
      customerName: clean.customerName || "Anonymous",
      rating: clean.source === "google_review" ? clean.rating ?? null : null,
      content: clean.content,
      outletId: clean.outletId,
      category: clean.category,
    });
  } catch (e) {
    return { error: persistMessage(e) };
  }

  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  return { ok: true, id: record.id };
}

export interface ResolveInput {
  id: string;
  status: ComplaintStatus;
  rootCause?: RootCauseCategory;
  actionDescription?: string;
  followUpDate?: string;
}

export async function bulkCloseComplaintsAction(ids: string[]) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "manage_complaint")) return { error: "No permission" };
  for (const id of ids) resolveComplaint({ id, status: "close" });
  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  return { ok: true, count: ids.length };
}

export async function resolveComplaintAction(input: ResolveInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "manage_complaint")) return { error: "No permission" };
  const parsed = parseInput(resolveComplaintSchema, input);
  if ("error" in parsed) return { error: parsed.error };
  const clean = parsed.data;

  resolveComplaint({
    id: clean.id,
    status: clean.status,
    rootCause: clean.rootCause,
    correctiveAction: clean.actionDescription
      ? {
          actionDate: new Date().toISOString(),
          picId: user.id,
          description: clean.actionDescription,
          followUpDate: clean.followUpDate ? new Date(clean.followUpDate).toISOString() : null,
        }
      : undefined,
  });

  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  return { ok: true };
}

export interface SubmitApprovalInput {
  id: string;
  rootCause: RootCauseCategory;
  actionDescription: string;
  followUpDate?: string;
}

/** Admin submits a resolution → routes to the Coordinator Area for approval. */
export async function submitComplaintApprovalAction(input: SubmitApprovalInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "manage_complaint")) return { error: "No permission" };
  const complaint = getComplaint(input.id);
  if (!complaint) return { error: "Complaint tidak ditemukan." };
  if (!canAccessOutlet(user, complaint.outletId, getOutlets())) return { error: "Outlet is outside your scope." };
  if (!input.actionDescription?.trim()) return { error: "Tindakan penyelesaian wajib diisi sebelum dikirim." };

  submitComplaintForApproval({
    id: input.id,
    submittedById: user.id,
    rootCause: input.rootCause,
    correctiveAction: {
      actionDate: new Date().toISOString(),
      picId: user.id,
      description: input.actionDescription.trim(),
      followUpDate: input.followUpDate ? new Date(input.followUpDate).toISOString() : null,
    },
  });

  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  return { ok: true };
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

/** Coordinator Area approves the resolution (optional photo + note) → done. */
export async function approveComplaintAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!canApproveComplaints(user.role)) return { error: "Hanya Coordinator Area yang dapat menyetujui." };
  const id = String(formData.get("id") || "");
  const note = String(formData.get("note") || "").trim();
  const complaint = getComplaint(id);
  if (!complaint) return { error: "Complaint tidak ditemukan." };
  if (!canAccessOutlet(user, complaint.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  let photoUrl: string | null = null;
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0) {
    if (!dbEnabled) return { error: "Storage belum aktif (Supabase belum dikonfigurasi)." };
    if (file.size > MAX_PHOTO_BYTES) return { error: "Foto melebihi 5 MB." };
    if (!file.type.startsWith("image/")) return { error: "File harus berupa gambar." };
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `complaint-approvals/${id}/${Date.now()}.${ext}`;
    const { error } = await db().storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
    if (error) return { error: `Upload foto gagal: ${error.message}` };
    photoUrl = db().storage.from("avatars").getPublicUrl(path).data.publicUrl;
  }

  approveComplaint({ id, approverId: user.id, approverName: user.name, note: note || null, photoUrl });

  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Coordinator Area returns the resolution for revision. */
export async function returnComplaintAction(input: { id: string; note?: string }) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!canApproveComplaints(user.role)) return { error: "Hanya Coordinator Area yang dapat mengembalikan." };
  const complaint = getComplaint(input.id);
  if (!complaint) return { error: "Complaint tidak ditemukan." };
  if (!canAccessOutlet(user, complaint.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  returnComplaintForRevision({ id: input.id, note: input.note?.trim() || null });

  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  return { ok: true };
}
