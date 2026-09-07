import type { Tone } from "@/lib/constants";

/**
 * Merek dikenali dari NAMA OUTLET, bukan kolom tersendiri.
 *
 * Tidak ada kolom merek di basis data, dan menambahkannya berarti 58 baris yang
 * harus diisi tangan lalu dijaga selamanya. Namanya sudah memuat mereknya di
 * depan; yang tidak dikenali dibiarkan kosong, bukan ditebak — merek salah
 * lebih buruk daripada merek yang tidak ditulis.
 *
 * Urutannya penting: "Ayam Goreng Busari" diuji sebelum pola lain supaya tidak
 * tertangkap aturan yang lebih longgar.
 */
export interface Merek {
  label: string;
  tone: Tone;
}

const POLA: { uji: RegExp; merek: Merek }[] = [
  { uji: /busari/i, merek: { label: "Busari", tone: "amber" } },
  { uji: /lesung\s*pipi/i, merek: { label: "Lesung Pipi", tone: "success" } },
  { uji: /cattu/i, merek: { label: "Cattu", tone: "cyan" } },
  { uji: /nordu/i, merek: { label: "Nordu", tone: "danger" } },
];

export const merekOutlet = (nama: string): Merek | null => POLA.find((p) => p.uji.test(nama))?.merek ?? null;

export const labelMerek = (nama: string): string => merekOutlet(nama)?.label ?? "—";
