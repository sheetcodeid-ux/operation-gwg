"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { hapusDokumen, simpanDokumen, type SimpanDokumenInput } from "@/lib/data/hcmos-dokumen";
import type { UserProfile } from "@/lib/types";

/**
 * Dokumen HC boleh DIBACA semua yang bisa membuka HC-MOS, tapi hanya boleh
 * DIUBAH oleh Human Capital dan Super Admin.
 *
 * Bedanya penting: SOP dan kebijakan memang untuk dibaca banyak orang — itu
 * gunanya. Yang tidak boleh adalah siapa pun bisa menyuntingnya.
 */
const bolehUbah = (u: UserProfile | null) =>
  !!u && (u.role === "super_admin" || u.role === "legal" || u.department === "Human Capital") && canReachMenu(u, "hcmos");

export async function simpanDokumenAction(input: SimpanDokumenInput): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!bolehUbah(user)) return { error: "Hanya Human Capital yang boleh mengubah dokumen." };
  if (!input.judul.trim()) return { error: "Judul wajib diisi." };
  if (input.berlakuMulai && input.berlakuSampai && input.berlakuSampai < input.berlakuMulai) {
    return { error: "Masa berlaku berakhir lebih awal daripada mulainya." };
  }
  try {
    await simpanDokumen(input, user!.id);
    revalidatePath("/hc-mos/dokumen");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}

export async function hapusDokumenAction(id: string): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!bolehUbah(user)) return { error: "Hanya Human Capital yang boleh menghapus dokumen." };
  try {
    await hapusDokumen(id);
    revalidatePath("/hc-mos/dokumen");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menghapus." };
  }
}
