import "server-only";

import { db, dbEnabled } from "./db";
import { RACI_ROLES, type RaciRole, type SuntinganRaci } from "@/lib/hcmos/raci";

/**
 * Suntingan matriks RACI.
 *
 * Isinya HANYA sel yang berbeda dari matriks Juknis; sel tanpa baris di sini
 * memakai bawaannya. Karena itu menghapus baris bukan "menghilangkan data",
 * melainkan mengembalikan sel itu ke susunan aslinya — dan itulah cara
 * mengembalikan satu sel maupun seluruh matriks.
 */

const peranValid = (v: string): v is RaciRole => (RACI_ROLES as readonly string[]).includes(v);

/** Simpanan sementara saat basis data dimatikan (mode pengembangan). */
const mem = new Map<string, SuntinganRaci>();
const kunci = (s: Pick<SuntinganRaci, "pilarSlug" | "subSlug" | "peran">) =>
  `${s.pilarSlug}::${s.subSlug}::${s.peran}`;

export async function getSuntinganRaci(): Promise<SuntinganRaci[]> {
  if (!dbEnabled) return [...mem.values()];
  const { data, error } = await db().from("hc_raci").select("pilar_slug,sub_slug,peran,pemegang");
  if (error) {
    // Matriksnya tetap harus tampil. Gagal membaca suntingan berarti yang
    // terlihat adalah susunan Juknis — kurang mutakhir, tapi benar dan lengkap,
    // jauh lebih baik daripada halaman yang menolak terbuka sama sekali.
    console.error("[raci] gagal membaca suntingan:", error.message);
    return [];
  }
  return ((data ?? []) as { pilar_slug: string; sub_slug: string; peran: string; pemegang: string }[])
    .filter((r) => peranValid(r.peran))
    .map((r) => ({
      pilarSlug: r.pilar_slug,
      subSlug: r.sub_slug,
      peran: r.peran as RaciRole,
      pemegang: r.pemegang,
    }));
}

/** Menyimpan satu sel. `null` mengembalikannya ke bawaan Juknis. */
export async function simpanSelRaci(
  sel: { pilarSlug: string; subSlug: string; peran: RaciRole },
  pemegang: string | null,
  olehId: string,
): Promise<{ error?: string }> {
  if (!dbEnabled) {
    if (pemegang === null) mem.delete(kunci(sel));
    else mem.set(kunci(sel), { ...sel, pemegang });
    return {};
  }

  if (pemegang === null) {
    const { error } = await db()
      .from("hc_raci")
      .delete()
      .eq("pilar_slug", sel.pilarSlug)
      .eq("sub_slug", sel.subSlug)
      .eq("peran", sel.peran);
    return error ? { error: error.message } : {};
  }

  const { error } = await db().from("hc_raci").upsert(
    {
      pilar_slug: sel.pilarSlug,
      sub_slug: sel.subSlug,
      peran: sel.peran,
      pemegang,
      updated_at: new Date().toISOString(),
      updated_by: olehId,
    },
    { onConflict: "pilar_slug,sub_slug,peran" },
  );
  return error ? { error: error.message } : {};
}

/**
 * Mengembalikan seluruh matriks — atau satu pilar — ke susunan Juknis.
 *
 * Menghapus baris suntingannya, bukan menuliskan nilai bawaan ke atasnya:
 * kalau bawaannya berubah nanti karena Juknis direvisi, sel yang pernah
 * dikembalikan harus ikut mengikuti revisi itu, bukan membeku pada nilai
 * bawaan versi lama.
 */
export async function kembalikanRaci(pilarSlug?: string): Promise<{ error?: string }> {
  if (!dbEnabled) {
    for (const [k, v] of mem) if (!pilarSlug || v.pilarSlug === pilarSlug) mem.delete(k);
    return {};
  }
  let q = db().from("hc_raci").delete();
  // Tanpa penyaring apa pun, PostgREST menolak DELETE — dan penolakan itu
  // memang benar. Pembanding yang selalu benar dipakai untuk menyatakan
  // "seluruh baris" secara sengaja, bukan karena lupa memberi syarat.
  q = pilarSlug ? q.eq("pilar_slug", pilarSlug) : q.neq("pilar_slug", "");
  const { error } = await q;
  return error ? { error: error.message } : {};
}
