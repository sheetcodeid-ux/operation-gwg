import { formatIDR, formatNumber } from "@/lib/utils";

/**
 * Cara menulis angka KPI — SATU tempat untuk seluruh halaman.
 *
 * Sebelumnya rumus yang sama persis disalin tiga kali: halaman KPI posisi,
 * KPI Manajemen, dan laporan PDF. Tiga salinan berarti tiga tempat yang harus
 * diubah serempak setiap kali aturannya bergeser — dan yang tertinggal membuat
 * satu angka tampil berbeda di layar dan di dokumen yang dicetak dari layar
 * itu juga.
 */

export const persen = (n: number | null, digit = 2): string =>
  n === null ? "—" : `${formatNumber(n, { minimumFractionDigits: digit, maximumFractionDigits: digit })}%`;

export const angka = (n: number | null): string => (n === null ? "—" : formatNumber(n, { maximumFractionDigits: 2 }));

export type Satuan = "angka" | "rupiah" | "persen";

/**
 * Angka dengan satuannya.
 *
 * Rp 13.244.543.327 dan "40%" dibaca berbeda dari "13244543327" dan "40" —
 * dan indikator yang salah dibaca satuannya akan disangka meleset jauh padahal
 * tepat. Yang tanpa satuan tetap angka biasa.
 */
export function bersatuan(n: number | null, satuan?: Satuan): string {
  if (n === null) return "—";
  if (satuan === "rupiah") return formatIDR(n);
  // Desimal ditulis kalau memang ada, dibuang kalau tidak: 100% tetap "100%",
  // tapi 18,18% tidak boleh muncul sebagai "18%". Angka otomatis seperti
  // Manajemen Kinerja hampir selalu berdesimal, dan yang membacanya akan
  // mencocokkannya dengan laporan yang menulis dua angka di belakang koma.
  if (satuan === "persen") return `${angka(n)}%`;
  return angka(n);
}

/**
 * Kolom ACTUAL: kosong ditulis NOL, bukan tanda pisah.
 *
 * Diminta pemiliknya, dan alasannya masuk akal: tanda pisah di kolom capaian
 * dibaca sebagai "tidak ada angkanya sama sekali", sementara yang dimaksud
 * hampir selalu "belum ada yang tercapai". Nol menjawab pertanyaan yang
 * sebenarnya ditanyakan orang saat melihat kolom itu — sudah sampai mana?
 *
 * NOL DI SINI TIDAK BERARTI NOL DI SKOR. Baris yang belum terukur tetap
 * dikeluarkan dari perhitungan skor, supaya indikator yang datanya belum
 * datang tidak menyeret turun capaian yang lain. Yang membedakan keduanya ada
 * di baris yang sama dan tidak bisa terlewat: kolom Persentase berbunyi
 * "belum ada data", lencana Status berbunyi "Belum terukur", dan kolom
 * Indikator memuat satu kalimat yang menjelaskan kenapa. Hanya kolom Actual
 * yang berubah.
 */
export function actualBersatuan(n: number | null, satuan?: Satuan): string {
  return bersatuan(n ?? 0, satuan);
}
