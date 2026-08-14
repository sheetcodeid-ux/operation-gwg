"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getOutlets } from "@/lib/data/store";
import { canAccessOutlet } from "@/lib/rbac";
import { periodeLabel } from "@/lib/hcmos/kontrak";
import { notify } from "@/lib/data/notify";
import {
  hapusKontrak,
  rekapOutlet,
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

/**
 * Ingatkan supervisor yang belum mengirim Update Bulanan.
 *
 * Berkas HTML aslinya memakai tautan `mailto:` — yang berarti membuka aplikasi
 * email di HP orang yang menekan tombolnya, lalu berharap ia benar-benar
 * mengirimnya. Di sini pengingatnya dikirim sebagai notifikasi di dalam sistem,
 * langsung ke akun supervisornya: ia sudah membuka aplikasi ini tiap hari untuk
 * hygiene dan komplain, dan notifikasinya membawa tautan yang begitu diklik
 * mendarat tepat di Kontrak Tracker. Tidak ada layanan email baru yang perlu
 * dibayar, dan tidak ada pengingat yang berhenti di kotak keluar seseorang.
 *
 * Outlet yang supervisornya belum terdaftar dilewati dan dilaporkan apa adanya
 * — mengaku "terkirim" untuk penerima yang tidak ada adalah kebohongan kecil
 * yang membuat kepatuhan terlihat sedang diurus padahal tidak.
 */
export async function kirimPengingatAction(input: {
  periode: string;
  /** Kosongkan untuk mengingatkan SEMUA outlet yang belum melapor. */
  outletId?: string;
}): Promise<{ ok?: true; terkirim?: number; tanpaSupervisor?: number; error?: string }> {
  const user = await getSessionUser();
  if (!bolehBuka(user)) return { error: "Tidak punya akses." };

  try {
    const rekap = await rekapOutlet(user!, input.periode);
    const sasaran = rekap.filter(
      (o) => !o.sudahLapor && (!input.outletId || o.id === input.outletId),
    );
    if (sasaran.length === 0) return { error: "Tidak ada outlet yang perlu diingatkan." };

    const punyaSpv = sasaran.filter((o) => o.supervisorId);
    await Promise.all(
      punyaSpv.map((o) =>
        notify({
          kind: "hc_update_due",
          title: `Update Bulanan ${periodeLabel(input.periode)} belum masuk`,
          message: `${o.name} belum mengirim laporan bulanan. Isi jumlah karyawan aktif dan catatannya lewat Kontrak Tracker.`,
          href: "/hc-mos/kontrak",
          targetUser: o.supervisorId,
          actorName: user!.name,
          outletId: o.id,
          severity: "warning",
        }),
      ),
    );

    segarkan();
    return {
      ok: true,
      terkirim: punyaSpv.length,
      tanpaSupervisor: sasaran.length - punyaSpv.length,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal mengirim pengingat." };
  }
}
