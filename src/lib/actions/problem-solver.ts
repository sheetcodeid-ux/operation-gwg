"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { problemSolverPerOutlet, simpanProblemSolver } from "@/lib/data/kpi";
import { daftarOutletSupervisor } from "@/lib/data/supervisor";

/**
 * Problem Solver — SATU-SATUNYA angka KPI Supervisor yang diisi tangan.
 *
 * Tiga indikator lainnya otomatis: penjualan dari ESB, laba dan pembelian dari
 * Unggah Data, komplain dari modul komplain. Yang tersisa cuma ini, dan itu
 * disengaja — indikator yang harus diketik untuk lima puluh delapan outlet tiap
 * bulan adalah indikator yang cepat atau lambat berhenti diisi.
 *
 * Karena itu pula ia bisa diunggah massal: mengetik satu per satu di layar
 * tetap disediakan untuk perbaikan kecil, tapi pengisian bulanannya lewat
 * berkas.
 */

export interface BarisProblemSolver {
  outletId: string;
  nama: string;
  kode: string;
  jenis: "Umum" | "KPK";
  /** Angka tersimpan. Null = belum pernah diisi bulan itu. */
  jumlah: number | null;
}

const bolehIsi = (role: string) => role === "super_admin" || role === "head_operation";

/** Daftar outlet beserta angka yang sudah tersimpan — pengisi tabel isian. */
export async function daftarProblemSolverAction(periode: string): Promise<BarisProblemSolver[]> {
  const user = await getSessionUser();
  if (!user || !bolehIsi(user.role)) return [];
  const tersimpan = await problemSolverPerOutlet(periode);
  return daftarOutletSupervisor().map((o) => ({
    outletId: o.id,
    nama: o.nama,
    kode: o.kode,
    jenis: o.jenis,
    jumlah: tersimpan.has(o.id) ? (tersimpan.get(o.id) ?? 0) : null,
  }));
}

export interface HasilSimpanPs {
  tersimpan: number;
  error?: string;
}

export async function simpanProblemSolverAction(input: {
  periode: string;
  baris: { outletId: string; jumlah: number }[];
}): Promise<HasilSimpanPs> {
  const user = await getSessionUser();
  if (!user || !bolehIsi(user.role)) {
    return { tersimpan: 0, error: "Hanya Admin dan Head Operation yang dapat mengisi Problem Solver." };
  }
  if (!/^\d{4}-\d{2}$/.test(input.periode)) return { tersimpan: 0, error: "Periodenya tidak terbaca." };

  // Hanya outlet yang MEMANG ADA yang disimpan. Berkas yang beredar lewat
  // WhatsApp bisa pulang dengan baris outlet yang sudah tidak aktif, dan baris
  // itu akan tersimpan diam-diam lalu tidak pernah muncul di mana pun.
  const sah = new Set(daftarOutletSupervisor().map((o) => o.id));
  const baris = input.baris
    .filter((b) => sah.has(b.outletId))
    .filter((b) => Number.isFinite(b.jumlah) && b.jumlah >= 0);

  const hasil = await simpanProblemSolver({
    periode: input.periode,
    baris,
    olehId: user.id,
    olehNama: user.name,
  });
  if (hasil.error) return { tersimpan: 0, error: hasil.error };

  revalidatePath("/kpi/supervisor");
  revalidatePath("/kpi/supervisor_umum");
  return { tersimpan: hasil.tersimpan };
}
