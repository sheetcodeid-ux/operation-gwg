"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { can, canAccessOutlet } from "@/lib/rbac";
import { getOutlet, getOutlets, userName } from "@/lib/data/store";
import { createHygiene } from "@/lib/data/mutations";
import { db, dbEnabled } from "@/lib/data/db";
import type { Attachment, HygieneRating, HygieneSection } from "@/lib/types";

export interface HygieneInput {
  outletId: string;
  shift: string;
  inspectorName: string;
  ratings: Record<HygieneSection, Record<string, HygieneRating>>;
  findings: string[];
  isClean: boolean;
  photos?: Attachment[];
}

const MAX_PHOTOS = 12;
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
    const { data } = db().storage.from("hygiene-photos").getPublicUrl(path);
    photos.push({ id: path, name: labels[i] || file.name, url: data.publicUrl, kind: "photo", size: file.size });
  }
  return { photos };
}

export async function createHygieneAction(input: HygieneInput) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!can(user, "create_hygiene")) return { error: "You don't have permission to create audits." };
  if (!canAccessOutlet(user, input.outletId, getOutlets())) return { error: "Outlet is outside your scope." };

  const outlet = getOutlet(input.outletId)!;
  const record = createHygiene({
    outletId: input.outletId,
    shift: input.shift,
    inspectorName: input.inspectorName.trim() || user.name,
    supervisorName: userName(outlet.supervisorId),
    ratings: input.ratings,
    findings: input.findings.filter((f) => f.trim()),
    isClean: input.isClean,
    photos: input.photos ?? [],
  });

  revalidatePath("/hygiene");
  revalidatePath("/dashboard");
  return { ok: true, id: record.id, score: record.hygieneScore };
}
