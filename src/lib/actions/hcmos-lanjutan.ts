"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { hapusBaris, simpanBaris } from "@/lib/data/hcmos-lanjutan";
import { tabelValid } from "@/lib/hcmos/tabel";
import type { UserProfile } from "@/lib/types";

/**
 * Tindakan umum untuk modul pilar HC-MOS.
 *
 * Nama tabel datang dari peramban, jadi ia diperiksa terhadap daftar putih
 * SEBELUM menyentuh apa pun. Tanpa pemeriksaan itu, satu permintaan yang
 * dirangkai sendiri bisa menulis ke tabel mana saja di basis data.
 */
const bolehHc = (u: UserProfile | null) =>
  !!u && (u.role === "super_admin" || u.role === "legal" || u.department === "Human Capital") && canReachMenu(u, "hcmos");

export async function simpanBarisAction(input: {
  tabel: string;
  isi: Record<string, unknown>;
  id?: string;
  /** Rute yang perlu disegarkan setelah tersimpan. */
  rute: string;
}): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!bolehHc(user)) return { error: "Hanya Human Capital yang boleh mengubah data ini." };
  if (!tabelValid(input.tabel)) return { error: "Data tidak dikenali." };

  try {
    await simpanBaris(input.tabel, input.isi, input.id, user!.id);
    // Hanya rute HC-MOS yang boleh disegarkan — rute sembarang dari peramban
    // tidak boleh dipakai untuk membatalkan cache halaman lain.
    if (input.rute.startsWith("/hc-mos")) revalidatePath(input.rute);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}

export async function hapusBarisAction(input: {
  tabel: string;
  id: string;
  rute: string;
}): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!bolehHc(user)) return { error: "Hanya Human Capital yang boleh menghapus data ini." };
  if (!tabelValid(input.tabel)) return { error: "Data tidak dikenali." };

  try {
    await hapusBaris(input.tabel, input.id);
    if (input.rute.startsWith("/hc-mos")) revalidatePath(input.rute);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menghapus." };
  }
}
