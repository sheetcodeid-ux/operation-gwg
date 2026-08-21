"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { hapusBaris, simpanBaris } from "@/lib/data/hcmos-lanjutan";
import { tandaiResignKontrak } from "@/lib/data/hcmos";
import { setUserActive } from "@/lib/data/user-mutations";
import { tindakanPenutupan } from "@/lib/hcmos/offboarding";
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
    if (input.tabel === "hc_cases") await tutupOffboarding(input.isi, user!.id);
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


/**
 * Langkah kelima alur Offboarding, dijalankan begitu perkaranya ditandai
 * selesai: kontraknya diberi tanggal resign dan akunnya dinonaktifkan.
 *
 * Sebelumnya langkah ini sepenuhnya manual dan ada di menu lain, jadi kalau
 * terlupa tidak ada yang memberi tahu — sementara justru langkah inilah yang
 * benar-benar mencabut akses. Orang yang sudah keluar tetap bisa masuk.
 *
 * Kegagalannya sengaja TIDAK membatalkan penyimpanan perkaranya. Perkara yang
 * sudah tersimpan dengan benar tidak boleh hilang gara-gara langkah susulan
 * gagal; yang tertinggal akan muncul sendiri di daftar "Perlu Ditutup" pada
 * halaman Offboarding, tempat manusia bisa melihat dan menuntaskannya.
 */
async function tutupOffboarding(isi: Record<string, unknown>, olehId: string): Promise<void> {
  const teks = (k: string) => {
    const v = isi[k];
    return v === null || v === undefined ? null : String(v) || null;
  };
  const tindakan = tindakanPenutupan({
    id: "",
    jenis: teks("jenis") ?? "",
    nama: teks("nama") ?? "",
    status: teks("status") ?? "",
    userId: teks("user_id"),
    kontrakId: teks("kontrak_id"),
    tglSelesai: teks("tgl_selesai"),
    tanggal: teks("tanggal"),
  });

  try {
    if (tindakan.tandaiResign) {
      await tandaiResignKontrak(tindakan.tandaiResign.kontrakId, tindakan.tandaiResign.tanggal, olehId);
    }
    if (tindakan.nonaktifkanUser) setUserActive(tindakan.nonaktifkanUser, false);
  } catch {
    // Ditelan dengan sengaja — lihat catatan di atas.
  }
}
