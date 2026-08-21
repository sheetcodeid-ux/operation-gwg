"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { persistMessage } from "@/lib/data/persist";
import { getUserDepartments, simpanPenempatanDepartemen } from "@/lib/data/user-departments";
import { bolehJadiAtasan, LEVEL_MAX, LEVEL_MIN, type SimpulBagan } from "@/lib/hcmos/bagan";
import { bolehUbahHc } from "@/lib/hcmos/akses";

/**
 * Menyusun bagan organisasi.
 *
 * Boleh diubah Human Capital dan super admin — sama seperti modul HC-MOS lain.
 * Menaruhnya di bawah izin `manage_users` akan salah alamat: yang menyusun
 * struktur organisasi adalah HC, bukan siapa pun yang kebetulan bisa membuat
 * akun.
 */
async function penyusun() {
  const user = await getSessionUser();
  return bolehUbahHc(user) ? user : null;
}

export async function simpanPenempatanAction(input: {
  id: string;
  level?: number | null;
  parentId?: string | null;
  posX?: number | null;
  posY?: number | null;
}): Promise<{ ok?: true; error?: string }> {
  if (!(await penyusun())) return { error: "Hanya Human Capital yang boleh menyusun bagan." };

  if (input.level !== undefined && input.level !== null) {
    if (!Number.isInteger(input.level) || input.level < LEVEL_MIN || input.level > LEVEL_MAX) {
      return { error: `Level harus antara ${LEVEL_MIN} dan ${LEVEL_MAX}.` };
    }
  }

  // Lingkaran dicegah SEBELUM tersimpan. Kalau lolos, layar yang seharusnya
  // dipakai memperbaikinya ikut membeku — jadi kesalahannya mengunci jalan
  // keluarnya sendiri.
  if (input.parentId !== undefined) {
    const dept = await getUserDepartments();
    const simpul: SimpulBagan[] = dept.map((d) => ({
      id: d.id,
      nama: d.name,
      level: d.level,
      parentId: d.parentId,
      urutan: d.urutan,
      posX: d.posX,
      posY: d.posY,
      jumlahOrang: 0,
      jabatan: d.jabatan,
    }));
    if (!bolehJadiAtasan(simpul, input.id, input.parentId)) {
      return { error: "Tidak bisa: pilihan itu membuat atasan dan bawahan berputar." };
    }
  }

  try {
    await simpanPenempatanDepartemen(input);
    revalidatePath("/hc-mos/struktur");
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}

/** Kembalikan seluruh posisi geseran ke tata letak otomatis. */
export async function rapikanBaganAction(): Promise<{ ok?: true; error?: string }> {
  if (!(await penyusun())) return { error: "Hanya Human Capital yang boleh menyusun bagan." };
  try {
    const dept = await getUserDepartments();
    await Promise.all(
      dept
        .filter((d) => d.posX !== null || d.posY !== null)
        .map((d) => simpanPenempatanDepartemen({ id: d.id, posX: null, posY: null })),
    );
    revalidatePath("/hc-mos/struktur");
    return { ok: true };
  } catch (e) {
    return { error: persistMessage(e) };
  }
}
