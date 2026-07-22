"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { updateUser } from "@/lib/data/user-mutations";
import { db, dbEnabled } from "@/lib/data/db";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

/** Any signed-in user uploads their own profile photo to the `avatars` bucket
 *  and stores the public URL on their account. */
export async function uploadMyAvatarAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "Not authenticated" };
  if (!dbEnabled) return { error: "Storage belum aktif (Supabase belum dikonfigurasi)." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Tidak ada file." };
  if (file.size > MAX_BYTES) return { error: "Foto melebihi 5 MB." };
  if (!file.type.startsWith("image/")) return { error: "File harus berupa gambar." };

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await db().storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { error: `Upload gagal: ${error.message}` };

  const { data } = db().storage.from("avatars").getPublicUrl(path);
  updateUser(user.id, { avatarUrl: data.publicUrl });

  revalidatePath("/profile");
  revalidatePath("/", "layout"); // refresh the topbar avatar too
  return { ok: true, url: data.publicUrl };
}
