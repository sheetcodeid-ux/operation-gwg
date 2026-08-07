/**
 * Sumber tunggal waktu "sekarang" untuk seluruh aplikasi.
 *
 * Dulu ini dipatok ke satu tanggal demo (23 Juni 2026) supaya cocok dengan data
 * contoh. Aplikasi sudah dipakai sungguhan, jadi patokan itu justru membuat
 * kalender membuka bulan yang salah, tanggal default meleset, dan penanda
 * terlambat menghitung dari bulan yang sudah lewat.
 *
 * Semuanya kini mengikuti jam nyata. Dibungkus fungsi — bukan konstanta —
 * karena instance server hidup berjam-jam: konstanta akan membeku di waktu boot
 * dan mengulang persoalan yang sama dalam bentuk lain.
 *
 * Aman diimpor dari server maupun client (tanpa dependensi data).
 */

/** Waktu sekarang dalam milidetik. */
export const nowMs = (): number => Date.now();

/** Waktu sekarang sebagai ISO string — dipakai sebagai nilai default form. */
export const nowIso = (): string => new Date().toISOString();

/** Tanggal hari ini dalam format YYYY-MM-DD (waktu lokal pengguna). */
export const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Bulan berjalan sebagai YYYY-MM — dipakai sebagai default filter bulan. */
export const currentMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
