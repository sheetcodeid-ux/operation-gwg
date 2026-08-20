/**
 * Hidrasi bersyarat — memutuskan tabel mana yang perlu dibaca ulang.
 *
 * Sebelumnya setiap kali singgahan kedaluwarsa, SELURUH isi enam tabel ditarik
 * ulang — entah ada yang berubah atau tidak. Sebagian besar waktu tidak ada
 * yang berubah, dan menarik 1,5 MB hanya untuk menemukan bahwa tidak ada yang
 * berubah adalah cara termahal untuk tidak melakukan apa-apa.
 *
 * Sekarang satu panggilan kecil (`gwg_sidik_tabel`) mengembalikan pencacah
 * sisip/ubah/hapus per tabel — beberapa ratus byte. Yang sidiknya bergeser saja
 * yang dibaca ulang.
 *
 * Seluruh keputusannya murni perbandingan, tanpa akses basis data, supaya bisa
 * diuji tanpa menyiapkan apa pun.
 */

export type PetaSidik = Map<string, string>;

/**
 * Tabel yang perlu dibaca ulang.
 *
 * Tiga aturan, dan urutannya menentukan:
 *
 *  1. Belum pernah hidrasi → baca SEMUA. Isi memori masih data contoh bawaan;
 *     melewatinya berarti menyajikan 59 nama karangan sebagai data perusahaan.
 *  2. Sidiknya tidak terbaca (fungsinya gagal, hak akses berubah) → baca SEMUA.
 *     Saat ragu, membaca terlalu banyak cuma memboroskan egress; membaca
 *     terlalu sedikit menyajikan data basi tanpa ada yang tahu.
 *  3. Sisanya: baca yang sidiknya berbeda, atau yang belum punya sidik sama
 *     sekali.
 */
export function tabelPerluDibaca(
  kandidat: readonly string[],
  sidikBaru: PetaSidik | null,
  sidikLama: PetaSidik | null,
): Set<string> {
  if (!sidikLama || !sidikBaru) return new Set(kandidat);
  return new Set(kandidat.filter((t) => sidikBaru.get(t) !== sidikLama.get(t)));
}

/**
 * Sidik yang disimpan setelah satu putaran hidrasi.
 *
 * Hanya tabel yang BERHASIL dibaca yang sidiknya diperbarui. Tabel yang gagal
 * sengaja mempertahankan sidik lamanya supaya putaran berikutnya mencobanya
 * lagi — kalau ikut diperbarui, kegagalannya tercatat sebagai keberhasilan dan
 * tabel itu tidak akan pernah dibaca ulang sampai datanya berubah lagi.
 */
export function sidikTersimpan(
  sidikBaru: PetaSidik | null,
  sidikLama: PetaSidik | null,
  gagal: readonly string[],
): PetaSidik | null {
  if (!sidikBaru) return sidikLama;
  const hasil = new Map(sidikBaru);
  for (const t of gagal) {
    const lama = sidikLama?.get(t);
    if (lama === undefined) hasil.delete(t);
    else hasil.set(t, lama);
  }
  return hasil;
}
