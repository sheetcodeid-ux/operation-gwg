import "server-only";

import { db, dbEnabled } from "./db";
import type { Attachment } from "@/lib/types";

/**
 * Foto audit hygiene diambil terpisah, tidak ikut cache bersama.
 *
 * Kolom `photos` adalah isi terberat di seluruh basis data yang dibaca aplikasi
 * (~1,8 MB untuk seluruh tabel) padahal hanya dipakai di halaman Hygiene. Dulu
 * ia ikut terbawa pada setiap permintaan halaman apa pun; sekarang hanya baris
 * yang benar-benar ditampilkan yang mengambilnya.
 */
export async function hygienePhotosByAudit(ids: string[]): Promise<Map<string, Attachment[]>> {
  const out = new Map<string, Attachment[]>();
  if (!dbEnabled || ids.length === 0) return out;
  try {
    const { data, error } = await db().from("hygiene").select("id,photos").in("id", ids.slice(0, 500));
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as { id: string; photos: Attachment[] | null }[]) {
      out.set(r.id, r.photos ?? []);
    }
  } catch (e) {
    // Halaman tetap tampil tanpa foto daripada gagal seluruhnya.
    console.error("[hygiene] gagal memuat foto:", e);
  }
  return out;
}
