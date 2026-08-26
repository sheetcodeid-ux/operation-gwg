"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can, canAccessOutlet } from "@/lib/rbac";
import { getComplaint, getOutlets, getUsers, outletName } from "@/lib/data/store";
import {
  approveComplaint,
  createComplaint,
  forwardComplaint,
  resolveComplaint,
  returnComplaintForRevision,
  submitComplaintForApproval,
} from "@/lib/data/mutations";
import { db, dbEnabled } from "@/lib/data/db";
import { R2_PREFIX, r2Enabled, r2Put } from "@/lib/storage/r2";
import { persistMessage } from "@/lib/data/persist";
import { notify } from "@/lib/data/notify";
import { complaintInputSchema, parseInput, resolveComplaintSchema } from "@/lib/validation";
import {
  canApproveComplaint,
  canForwardComplaint,
  canInputComplaint,
  canResolveComplaint,
} from "@/lib/complaints-access";
import type {
  ComplaintCategory,
  ComplaintSource,
  ComplaintStatus,
  RootCauseCategory,
} from "@/lib/types";

/**
 * Alur komplain:
 *  • MarComm / Admin memasukkan komplain      → create
 *  • Coordinator Area meneruskan ke supervisor → forward
 *  • Supervisor mengerjakan perbaikan          → submit resolution
 *  • Coordinator Area menilai hasilnya         → approve / return
 * Super Admin boleh melakukan langkah mana pun sebagai jalan darurat.
 *
 * Aturan siapa-boleh-apa ada di `@/lib/complaints-access` — satu berkas yang
 * dipakai server MAUPUN antarmuka, supaya tombol yang tampil tidak pernah
 * berbeda dari yang benar-benar diizinkan server.
 */

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
  if (!canInputComplaint(user)) return { error: "Tidak berwenang memasukkan komplain." };
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

  // Masuk ke notifikasi Operation — di situlah Coordinator Area berada, dan
  // merekalah yang harus meneruskannya ke supervisor cabang.
  await notify({
    kind: "complaint_new",
    department: OPERATION_DEPARTMENT,
    title: "Komplain baru masuk",
    message: `${outletName(record.outletId)} — ${record.content}`,
    href: "/complaints",
    actorName: user!.name,
    outletId: record.outletId,
    severity: "warning",
  });

  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  return { ok: true, id: record.id };
}

/**
 * Departemen yang menangani komplain setelah masuk.
 *
 * Coordinator Area berada di departemen ini, dan merekalah yang meneruskan ke
 * supervisor. Nilainya harus sama persis dengan `users.department`.
 */
const OPERATION_DEPARTMENT = "Operational";

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

/**
 * Supervisor yang memegang satu outlet — kandidat penerima komplainnya.
 *
 * Dicari lewat `users.outletIds`, BUKAN `outlets.supervisorId`: kolom lama itu
 * di basis data ini menunjuk akun Admin untuk setiap outlet, jadi memakainya
 * membuat seluruh komplain terkirim ke Admin alih-alih ke supervisor cabangnya.
 */
export async function complaintSupervisorsAction(
  outletId: string,
): Promise<{ id: string; name: string }[]> {
  const user = await getSessionUser();
  if (!canForwardComplaint(user)) return [];
  const outlet = getOutlets().find((o) => o.id === outletId);
  if (!outlet) return [];
  return getUsers()
    .filter(
      (u) =>
        u.active &&
        u.role === "supervisor" &&
        (u.outletIds ?? []).some((id) => id === outlet.id || id === outlet.code),
    )
    .map((u) => ({ id: u.id, name: u.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

/**
 * Coordinator Area meneruskan komplain ke supervisor cabang yang bersangkutan.
 *
 * Wajib disertai arahan: "diteruskan" tanpa keterangan memaksa supervisornya
 * menebak bagian mana yang bermasalah, dan itu justru memperlambat perbaikan.
 */
export async function forwardComplaintAction(input: {
  id: string;
  supervisorId: string;
  note: string;
}): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "Tidak punya akses." };
  if (!canForwardComplaint(user)) return { error: "Hanya Coordinator Area yang dapat meneruskan komplain." };

  const complaint = getComplaint(input.id);
  if (!complaint) return { error: "Komplain tidak ditemukan." };
  if (!canAccessOutlet(user, complaint.outletId, getOutlets())) {
    return { error: "Outlet itu di luar cakupan Anda." };
  }
  if (complaint.status === "close") return { error: "Komplain ini sudah ditutup." };

  const note = input.note.trim();
  if (!note) return { error: "Tulis dulu arahan perbaikannya." };

  // Penerima harus benar-benar supervisor outlet itu — kalau tidak, id tebakan
  // bisa dipakai menugaskan komplain ke orang yang tidak berkepentingan.
  const kandidat = await complaintSupervisorsAction(complaint.outletId);
  const spv = kandidat.find((k) => k.id === input.supervisorId);
  if (!spv) return { error: "Supervisor itu tidak memegang outlet tersebut." };

  forwardComplaint({
    id: input.id,
    assignedTo: spv.id,
    assignedToName: spv.name,
    assignedBy: user.id,
    assignedByName: user.name,
    note,
  });

  await notify({
    kind: "complaint_forwarded",
    targetUser: spv.id,
    title: "Komplain diteruskan kepada Anda",
    message: `${complaint.content} — ${note}`,
    href: "/complaints",
    actorName: user.name,
    outletId: complaint.outletId,
    severity: "warning",
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

/** Supervisor submits the follow-up → routes to the Coordinator Area for approval. */
export async function submitComplaintApprovalAction(input: SubmitApprovalInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!canResolveComplaint(user)) return { error: "No permission" };
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
  if (!canApproveComplaint(user)) return { error: "Hanya Coordinator Area yang dapat menyetujui." };
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
    // Bukan bucket `avatars`. Bucket itu publik karena foto profil memang harus
    // terbuka; menumpangkan bukti verifikasi ke sana membuatnya ikut terbuka.
    if (r2Enabled()) {
      try {
        await r2Put(path, await file.arrayBuffer(), file.type);
      } catch (e) {
        console.error("[complaint] unggah foto verifikasi gagal:", e);
        return { error: "Upload foto gagal: penyimpanan tidak merespons." };
      }
      photoUrl = `${R2_PREFIX}${path}`;
    } else {
      const { error } = await db().storage.from("system-attachments").upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (error) return { error: `Upload foto gagal: ${error.message}` };
      photoUrl = path;
    }
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
  if (!canApproveComplaint(user)) return { error: "Hanya Coordinator Area yang dapat mengembalikan." };
  const complaint = getComplaint(input.id);
  if (!complaint) return { error: "Complaint tidak ditemukan." };
  if (!canAccessOutlet(user, complaint.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  returnComplaintForRevision({ id: input.id, note: input.note?.trim() || null });

  revalidatePath("/complaints");
  revalidatePath("/dashboard");
  return { ok: true };
}
