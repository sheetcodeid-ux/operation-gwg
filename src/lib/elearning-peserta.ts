/**
 * Aturan siapa peserta satu subject E-Learning.
 *
 * SENGAJA BEBAS `server-only`. Aturannya dipakai server (saat memutuskan apa
 * yang dimuat) DAN layar (saat menerangkan akibatnya kepada yang mengisi).
 * Kalau ia hanya hidup di sisi server, layar akan menuliskan ulang aturan yang
 * sama dengan kalimatnya sendiri — dan dua salinan aturan selalu berakhir
 * berbeda.
 *
 * ATURAN KOSONG YANG DISENGAJA:
 *
 *   Subject TANPA satu pun baris peserta berarti TERBUKA untuk semua peserta.
 *
 * Bukan "belum ada pesertanya", melainkan "berlaku untuk semua". Itulah yang
 * membuat perubahan ini bisa dipasang tanpa backfill: seluruh course yang sudah
 * ada hari ini tidak punya baris peserta, jadi mereka tetap terbuka persis
 * seperti sebelumnya, dan tidak ada satu pun karyawan yang mendadak kehilangan
 * materinya. HC memindahkannya satu per satu kapan pun mereka siap.
 *
 * Konsekuensinya yang harus diingat: "hapus semua peserta" TIDAK menutup
 * subject untuk semua orang — ia justru membukanya kembali. Menutup subject
 * dilakukan dengan menonaktifkannya, bukan dengan mengosongkan pesertanya.
 */

/** Subject terbuka untuk semua, atau hanya untuk yang terdaftar? */
export const subjectTerbuka = (ditugaskan: string[]): boolean => ditugaskan.length === 0;

/** Boleh dibuka peserta ini? Terbuka, atau namanya terdaftar. */
export function bolehIkut(ditugaskan: string[], userId: string): boolean {
  return subjectTerbuka(ditugaskan) || ditugaskan.includes(userId);
}

/**
 * Siapa yang BENAR-BENAR terhitung peserta satu subject.
 *
 * Dipisah dari daftar penugasannya karena keduanya menjawab pertanyaan
 * berbeda: yang satu "siapa yang ditugaskan" (untuk layar penyuntingan), yang
 * ini "siapa yang terhitung" (untuk penyebut setiap persentase). Disatukan,
 * layar penyuntingan akan menampilkan seratus nama tercentang yang tidak
 * pernah dipilih siapa pun.
 *
 * Nama yang sudah tidak ada di sistem (karyawan keluar) ikut tersaring di
 * sini — kalau tidak, ia tetap jadi penyebut persentase yang tidak akan pernah
 * bisa dicapai.
 */
export function pesertaEfektif<T extends { id: string }>(ditugaskan: string[], semua: T[]): T[] {
  if (ditugaskan.length === 0) return semua;
  const set = new Set(ditugaskan);
  return semua.filter((u) => set.has(u.id));
}
