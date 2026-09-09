import "server-only";

import { hariTerhitung, netMingguanPerCabang } from "./esb-mingguan";
import {
  hitungMinggu,
  korporatMinggu,
  mingguBulan,
  type BarisMinggu,
  type RentangMinggu,
  type SumberMinggu,
} from "@/lib/kpi/minggu";

/**
 * Rincian MINGGU DEMI MINGGU dalam satu bulan, per outlet.
 *
 * DIPAKAI BERSAMA oleh KPI Manajemen dan KPI Coordinator Area. Keduanya
 * menanyakan hal yang persis sama — outlet mana yang tertinggal minggu ini,
 * dan harus mengejar berapa — hanya berbeda outlet mana yang ikut dihitung.
 * Menyusunnya dua kali berarti dua tempat yang bisa berbeda diam-diam, dan
 * satu outlet akan terbaca tertinggal di satu halaman dan aman di halaman
 * sebelahnya tanpa ada cara tahu mana yang benar.
 */
export interface DetailMinggu {
  /** Pembagian minggu bulan itu: 1–7, 8–14, 15–21, 22–28, sisanya. */
  minggu: RentangMinggu[];
  /** Satu baris per outlet, sudah lengkap dengan target dan angka kejarnya. */
  baris: BarisMinggu[];
  /** Jumlah seluruh outlet yang ikut. Null = tidak ada satu pun yang terukur. */
  korporat: BarisMinggu | null;
  /** Outlet yang omzetnya diketik bulanan sehingga tak punya rincian mingguan. */
  tanpaRincian: number;
}

/** Satu outlet sebagaimana dibutuhkan rincian mingguan. */
export interface OutletMinggu {
  id: string;
  nama: string;
  kode?: string | null;
  /** Cabang ESB-nya; kosong berarti tidak punya rincian mingguan. */
  cabang?: string | null;
  /** Target sebulan outlet itu — rata-rata tiga bulan + pertumbuhan. */
  targetBulan: number;
  /** Bulan ini omzetnya diketik tangan, jadi tidak punya rincian mingguan. */
  manual?: boolean;
}

/**
 * Susun rincian mingguan satu kumpulan outlet.
 *
 * TARGETNYA TARGET OUTLET ITU SENDIRI, bukan target gabungan dibagi rata.
 * Angka yang sama dipakai kolom Target di tabel bulanan — kalau di sini dibagi
 * rata, satu outlet bisa terlihat gagal di tab ini dan tercapai di tab
 * sebelahnya, dan yang membacanya tidak punya cara tahu mana yang benar.
 *
 * OUTLET YANG OMZETNYA DIKETIK BULANAN TIDAK DIBERI ANGKA NOL. Bulan yang
 * ditandai manual memang tidak punya rincian mingguan — angkanya masuk sebagai
 * satu total sebulan — dan nol di situ akan terbaca sebagai outlet yang tidak
 * berjualan seminggu penuh. Barisnya tetap tampil, ditandai, dan dikeluarkan
 * dari jumlah gabungan supaya totalnya tidak ikut tertarik ke bawah.
 *
 * Mengembalikan null bila ESB belum menarik satu minggu pun: halaman yang
 * kosong dengan penjelasan lebih jujur daripada tabel berisi nol.
 */
export async function rincianMinggu(periode: string, outlet: OutletMinggu[], hari: number): Promise<DetailMinggu | null> {
  const minggu = mingguBulan(periode);
  const peta = await netMingguanPerCabang(periode);
  if (peta.size === 0) return null;

  const sumber: SumberMinggu[] = outlet.map((o) => {
    const cabang = o.cabang ?? null;
    const tanpaRincian = o.manual === true || cabang === null;
    const baris = minggu.map((m) => (tanpaRincian ? null : (peta.get(`${cabang}|${m.minggu}`) ?? null)));
    return {
      id: o.id,
      nama: o.nama,
      kode: o.kode ?? o.id,
      targetBulan: o.targetBulan,
      actual: baris.map((r) => (r === null ? null : r.net)),
      hariAda: minggu.map((m, i) => hariTerhitung(periode, m, baris[i]?.sampai ?? null)),
      tanpaRincian,
    };
  });

  const baris = hitungMinggu(sumber, minggu, hari);
  return {
    minggu,
    baris,
    korporat: korporatMinggu(baris, minggu, hari),
    tanpaRincian: baris.filter((b) => b.tanpaRincian).length,
  };
}
