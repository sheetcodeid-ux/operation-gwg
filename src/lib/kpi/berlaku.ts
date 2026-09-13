/**
 * Sejak kapan sebuah posisi mulai dinilai.
 *
 * Posisi baru dibuat pertengahan jalan — Online Delivery Officer, misalnya,
 * KPI-nya berlaku mulai September. Pada bulan Agustus posisi itu belum punya
 * data sama sekali, tapi tetap ikut dihitung sebagai anggota departemennya:
 * rata-rata Operational turun, dan KPI Manajemen ikut turun, gara-gara orang
 * yang bulan itu memang belum dinilai.
 *
 * DISIMPAN SEBAGAI BULAN MULAI, BUKAN SAKELAR NYALA-MATI. Sakelar menuntut
 * seseorang ingat menyalakannya lagi tepat pada bulan yang benar; kalau lupa,
 * bulan yang seharusnya dinilai ikut hilang dan tidak ada yang memberi tahu.
 * Bulan mulai ditetapkan sekali dan benar selamanya — ke depan maupun saat
 * membuka kembali bulan-bulan yang sudah lewat.
 */

export interface SetelanPosisi {
  /** Ditiadakan sama sekali — tidak dinilai pada bulan mana pun. */
  aktif: boolean;
  /** "YYYY-MM". Kosong berarti berlaku sejak kapan pun. */
  berlakuMulai: string | null;
}

export const SETELAN_POSISI_BAWAAN: SetelanPosisi = { aktif: true, berlakuMulai: null };

/** Apakah posisi ini dinilai pada periode tersebut. */
export function posisiDinilai(setelan: SetelanPosisi | undefined, periode: string): boolean {
  const s = setelan ?? SETELAN_POSISI_BAWAAN;
  if (!s.aktif) return false;
  if (!s.berlakuMulai) return true;
  // Perbandingan teks "YYYY-MM" berurutan sama dengan perbandingan tanggal,
  // dan tidak melibatkan zona waktu sama sekali — dua hal yang membuat
  // perbandingan tanggal salah tanpa ketahuan.
  return periode >= s.berlakuMulai;
}

/** Kenapa sebuah posisi tidak dinilai bulan itu — ditulis apa adanya di layar. */
export function alasanBelumDinilai(setelan: SetelanPosisi | undefined, periode: string): string | null {
  const s = setelan ?? SETELAN_POSISI_BAWAAN;
  if (!s.aktif) return "KPI posisi ini sedang dinonaktifkan.";
  if (s.berlakuMulai && periode < s.berlakuMulai) return `KPI posisi ini berlaku mulai ${labelBulan(s.berlakuMulai)}.`;
  return null;
}

export function labelBulan(periode: string): string {
  const [y, m] = periode.split("-").map(Number);
  if (!y || !m) return periode;
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}
