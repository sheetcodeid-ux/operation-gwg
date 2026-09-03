/**
 * Pemilih bulan KPI — TAHUN dan BULAN terpisah, bukan "2026-09".
 *
 * Satu dropdown berisi "2026-09" memaksa orang membaca angka dan menerjemahkan
 * sendiri bulan keberapa itu. Dua dropdown berisi "2026" dan "September" tidak
 * perlu diterjemahkan sama sekali — dan itulah satu-satunya alasan bentuknya
 * dipisah.
 */

export const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

/** Pilihan bulan: nilainya "01".."12", labelnya nama bulan. */
export const BULAN = NAMA_BULAN.map((nama, i) => ({
  value: String(i + 1).padStart(2, "0"),
  label: nama,
}));

/**
 * Tahun yang bisa dipilih.
 *
 * Dua tahun ke belakang dan satu ke depan: cukup untuk melihat riwayat dan
 * menyiapkan periode berikutnya, tanpa membuat daftar panjang berisi tahun yang
 * tidak akan pernah dibuka.
 */
export function tahunPilihan(sekarang = new Date().getFullYear()): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let t = sekarang + 1; t >= sekarang - 2; t -= 1) out.push({ value: String(t), label: String(t) });
  return out;
}

export const periodeDari = (tahun: string, bulan: string): string => `${tahun}-${bulan}`;

/** "2026-09" → "September 2026". */
export function labelPeriode(periode: string): string {
  const [th, bl] = periode.split("-");
  const i = Number(bl) - 1;
  return i >= 0 && i < 12 ? `${NAMA_BULAN[i]} ${th}` : periode;
}
