import type { BarisHcmos } from "@/lib/data/hcmos-lanjutan";
import type { RekamanPelatihan } from "./pelatihan";

/**
 * Baris mentah `hc_training_records` → bentuk yang dipakai perhitungan.
 *
 * Dipisahkan dari `pelatihan.ts` supaya berkas itu tetap murni hitungan dan
 * bisa diuji tanpa menyentuh tipe basis data sama sekali.
 */
export function bacaRekamanPelatihan(rows: BarisHcmos[]): RekamanPelatihan[] {
  return rows.map((r) => ({
    nama: String(r.nama ?? ""),
    materi: String(r.materi ?? ""),
    program: String(r.program ?? ""),
    batch: String(r.batch ?? ""),
    outletName: r.outletName ?? null,
    tanggal: r.tanggal ? String(r.tanggal) : null,
    postTest: r.post_test === null || r.post_test === undefined ? null : Number(r.post_test),
  }));
}
