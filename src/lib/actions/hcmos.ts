"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getOutlets } from "@/lib/data/store";
import { canAccessOutlet } from "@/lib/rbac";
import {
  hapusKontrak,
  outletDariKontrak,
  riwayatUpdateBulanan,
  simpanKontrak,
  simpanUpdateBulanan,
  type SimpanKontrakInput,
  type UpdateBulanan,
} from "@/lib/data/hcmos";
import type { UserProfile } from "@/lib/types";

/**
 * Tindakan Kontrak Tracker.
 *
 * Wewenangnya diperiksa DUA lapis, dan keduanya perlu:
 *  1. boleh membuka menunya sama sekali, dan
 *  2. outlet yang disentuh memang outlet orang itu.
 *
 * Lapis kedua yang menggantikan "Portal Supervisor" pada berkas HTML lama.
 * Di sana siapa pun bisa memilih outlet mana saja dari dropdown lalu mengetik
 * nama — peringatan kalau namanya tidak cocok pun bisa dilewati dengan klik
 * sekali lagi. Di sini supervisor sudah masuk sebagai dirinya, dan outlet yang
 * bukan miliknya ditolak di server, bukan disembunyikan di tampilan.
 */

const bolehBuka = (u: UserProfile | null) => !!u && canReachMenu(u, "hc_kontrak");

/** Apakah pengguna ini berhak menulis data outlet tersebut. */
function bolehOutlet(user: UserProfile, outletId: string): boolean {
  return canAccessOutlet(user, outletId, getOutlets());
}

function segarkan() {
  revalidatePath("/hc-mos");
  revalidatePath("/hc-mos/kontrak");
}

export async function simpanKontrakAction(
  input: SimpanKontrakInput,
): Promise<{ ok?: true; id?: string; error?: string }> {
  const user = await getSessionUser();
  if (!bolehBuka(user)) return { error: "Tidak punya akses." };
  if (!input.nama.trim()) return { error: "Nama karyawan wajib diisi." };
  if (!input.outletId) return { error: "Outlet belum dipilih." };
  if (!bolehOutlet(user!, input.outletId)) return { error: "Outlet ini bukan tanggung jawab Anda." };

  // Kontrak yang berakhir sebelum dimulai hampir pasti salah ketik tanggal.
  if (input.tglMulai && input.tglBerakhir && input.tglBerakhir < input.tglMulai) {
    return { error: "Tanggal berakhir lebih awal daripada tanggal mulai." };
  }

  // Baris yang sedang diubah harus benar-benar milik outlet yang diklaim —
  // tanpa ini, id dari outlet lain bisa dititipkan bersama outletId sendiri.
  if (input.id) {
    const asal = await outletDariKontrak(input.id);
    if (!asal) return { error: "Data karyawan tidak ditemukan." };
    if (!bolehOutlet(user!, asal)) return { error: "Data ini bukan milik outlet Anda." };
  }

  try {
    const { id } = await simpanKontrak(input, user!.id);
    segarkan();
    return { ok: true, id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}

export async function hapusKontrakAction(id: string): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!bolehBuka(user)) return { error: "Tidak punya akses." };
  try {
    const asal = await outletDariKontrak(id);
    if (!asal) return { error: "Data karyawan tidak ditemukan." };
    if (!bolehOutlet(user!, asal)) return { error: "Data ini bukan milik outlet Anda." };
    await hapusKontrak(id);
    segarkan();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menghapus." };
  }
}

export async function simpanUpdateBulananAction(input: {
  outletId: string;
  periode: string;
  jumlahKaryawan: number;
  catatan: string;
}): Promise<{ ok?: true; error?: string }> {
  const user = await getSessionUser();
  if (!bolehBuka(user)) return { error: "Tidak punya akses." };
  if (!bolehOutlet(user!, input.outletId)) return { error: "Outlet ini bukan tanggung jawab Anda." };
  if (!/^\d{4}-\d{2}$/.test(input.periode)) return { error: "Periode tidak valid." };
  if (input.jumlahKaryawan < 0) return { error: "Jumlah karyawan tidak boleh negatif." };

  try {
    await simpanUpdateBulanan({
      ...input,
      olehId: user!.id,
      olehNama: user!.name,
    });
    segarkan();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan laporan." };
  }
}

/** Riwayat laporan bulanan satu outlet — dibuka dari dalam tabel. */
export async function riwayatUpdateAction(outletId: string): Promise<UpdateBulanan[] | { error: string }> {
  const user = await getSessionUser();
  if (!bolehBuka(user)) return { error: "Tidak punya akses." };
  if (!bolehOutlet(user!, outletId)) return { error: "Outlet ini bukan tanggung jawab Anda." };
  try {
    return await riwayatUpdateBulanan(outletId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal memuat riwayat." };
  }
}
