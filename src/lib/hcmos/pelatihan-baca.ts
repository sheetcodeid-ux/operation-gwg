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
    preTest: angka(r.pre_test),
    rolePlay: angka(r.role_play),
    postTest: angka(r.post_test),
  }));
}

/** Kolom nilai boleh kosong; kosong berarti belum dinilai, bukan nol. */
const angka = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));
