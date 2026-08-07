"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can, canAccessOutlet } from "@/lib/rbac";
import { getOutlet, getOutlets, userName } from "@/lib/data/store";
import { createHygiene, deleteHygiene } from "@/lib/data/mutations";
import { persistMessage } from "@/lib/data/persist";
import { db, dbEnabled } from "@/lib/data/db";
import { hygieneInputSchema, parseInput } from "@/lib/validation";
import { HYGIENE_PHOTO_GROUPS, HYGIENE_PHOTO_GROUPS_OPTIONAL } from "@/lib/constants";
import type { Attachment, HygieneRating, HygieneSection } from "@/lib/types";

export interface HygieneInput {
  outletId: string;
  shift: string;
  inspectorName: string;
  ratings: Record<HygieneSection, Record<string, HygieneRating>>;
  findings: string[];
  isClean: boolean;
  photos?: Attachment[];
  date?: string;
}

// A full audit is every photo area × 3 photos each; allow that many per call
// (with a little headroom) so a size-batched upload of the whole audit is never
// rejected. Area etalase yang opsional ikut dihitung — kalau tidak, audit dari
// outlet yang punya etalase justru ditolak karena kelebihan foto.
const MAX_PHOTOS = (HYGIENE_PHOTO_GROUPS.length + HYGIENE_PHOTO_GROUPS_OPTIONAL.length) * 3 + 3;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per photo

/** Upload audit photos to Supabase Storage; returns permanent public URLs.
 *  FormData fields: repeated "file" entries + optional matching "label"s. */
export async function uploadHygienePhotosAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_hygiene")) return { error: "No permission" };
  if (!dbEnabled) return { error: "Storage belum aktif (Supabase belum dikonfigurasi)." };

  const files = formData.getAll("file").filter((f): f is File => f instanceof File);
  const labels = formData.getAll("label").map(String);
  if (files.length === 0) return { photos: [] as Attachment[] };
  if (files.length > MAX_PHOTOS) return { error: `Maksimal ${MAX_PHOTOS} foto.` };

  const photos: Attachment[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > MAX_BYTES) return { error: `Foto "${file.name}" melebihi 5 MB.` };
    if (!file.type.startsWith("image/")) return { error: `"${file.name}" bukan gambar.` };
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
    const path = `${user.id}/${Date.now()}-${i}-${safe}`;
    const { error } = await db().storage.from("hygiene-photos").upload(path, file, { contentType: file.type });
    if (error) return { error: `Upload gagal: ${error.message}` };
    // Bucket is private — a public URL would 400. Sign for ~1 year; `id` keeps
    // the object path so the URL can be re-signed on read when it expires.
    const { data, error: signError } = await db()
      .storage.from("hygiene-photos")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signError || !data) return { error: `Gagal membuat URL foto: ${signError?.message ?? "unknown"}` };
    photos.push({ id: path, name: labels[i] || file.name, url: data.signedUrl, kind: "photo", size: file.size });
  }
  return { photos };
}

export async function createHygieneAction(input: HygieneInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_hygiene")) return { error: "You don't have permission to create audits." };
  const parsed = parseInput(hygieneInputSchema, input);
  if ("error" in parsed) return { error: parsed.error };
  const clean = parsed.data;
  if (!canAccessOutlet(user, clean.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  const outlet = getOutlet(clean.outletId)!;
  let record;
  try {
    record = await createHygiene({
      outletId: clean.outletId,
      shift: clean.shift,
      inspectorName: clean.inspectorName || user.name,
      supervisorName: userName(outlet.supervisorId),
      ratings: input.ratings,
      findings: clean.findings.filter((f) => f.trim()),
      isClean: clean.isClean,
      photos: input.photos ?? [],
      date: input.date,
    });
  } catch (e) {
    return { error: persistMessage(e) };
  }

  revalidatePath("/hygiene");
  revalidatePath("/dashboard");
  return { ok: true, id: record.id, score: record.hygieneScore };
}

/** Admin-only: delete a hygiene audit. */
export async function deleteHygieneAction(id: string) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "super_admin") return { error: "Hanya Admin yang dapat menghapus audit." };
  const ok = deleteHygiene(id);
  if (!ok) return { error: "Audit tidak ditemukan." };
  revalidatePath("/hygiene");
  revalidatePath("/dashboard");
  return { ok: true };
}
