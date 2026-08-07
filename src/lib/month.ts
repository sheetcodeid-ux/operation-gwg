/**
 * Pembantu bulan yang murni — tanpa React, supaya bisa dipakai server MAUPUN
 * klien. Sebelumnya ini tinggal di komponen "use client", jadi halaman server
 * tidak bisa memakainya untuk membatasi data sebelum dikirim ke browser.
 */

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Kunci bulan sebuah tanggal ISO. Indeks bulan 0-based — cocok MONTH_NAMES. */
export function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, "0")}`;
}

export function monthKeyLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[Number(m)]} ${y}`;
}

/** Bulan-bulan berbeda (terbaru dulu) yang ada di daftar tanggal → opsi filter. */
export function monthOptions(isoDates: string[]): { value: string; label: string }[] {
  const keys = [...new Set(isoDates.map(monthKey))].sort().reverse();
  return keys.map((k) => ({ value: k, label: monthKeyLabel(k) }));
}
