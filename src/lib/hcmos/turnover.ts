/**
 * Turnover — dihitung sebagai PERSENTASE, bukan cacahan.
 *
 * "3 orang keluar bulan ini" tidak berarti apa-apa sampai diketahui dari
 * berapa: tiga dari dua puluh adalah keadaan darurat, tiga dari dua ratus
 * adalah bulan yang biasa saja. Karena itu tiap angka di sini selalu membawa
 * penyebutnya.
 *
 * Penyebutnya memakai headcount RATA-RATA sepanjang bulan — (awal + akhir) / 2
 * — bukan headcount akhir bulan. Kalau memakai yang akhir, bulan dengan banyak
 * kepergian membagi dengan angka yang sudah menyusut akibat kepergian itu
 * sendiri, sehingga persentasenya membesar dua kali dari sebab yang sama.
 */

export interface RiwayatKerja {
  /** Tanggal mulai bekerja. Tanpa ini orangnya tidak bisa dihitung sebagai
   *  bagian dari headcount bulan mana pun. */
  masuk: string | null;
  /** Tanggal keluar; null berarti masih bekerja. */
  resign: string | null;
}

export interface TitikTurnover {
  /** Format `2026-08`. */
  bulan: string;
  keluar: number;
  headcount: number;
  persen: number;
}

const hari = (iso: string | null): number | null => {
  if (!iso) return null;
  const w = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(w) ? null : w;
};

const akhirBulan = (tahun: number, bulan: number): number =>
  Date.UTC(tahun, bulan + 1, 0);

const awalBulan = (tahun: number, bulan: number): number => Date.UTC(tahun, bulan, 1);

/** Jumlah orang yang sedang bekerja pada suatu saat. */
export function headcountPada(rows: RiwayatKerja[], saat: number): number {
  return rows.filter((r) => {
    const masuk = hari(r.masuk);
    if (masuk === null || masuk > saat) return false;
    const resign = hari(r.resign);
    // `>=`, bukan `>`: tanggal resign adalah hari kerja TERAKHIR, bukan hari
    // pertama seseorang tidak lagi bekerja. Dengan `>`, orang yang keluar di
    // akhir bulan hilang dari headcount bulan yang masih ia jalani penuh.
    return resign === null || resign >= saat;
  }).length;
}

/** Berapa orang yang keluar dalam rentang waktu tertutup di kedua ujungnya. */
export function keluarAntara(rows: RiwayatKerja[], mulai: number, selesai: number): number {
  return rows.filter((r) => {
    const resign = hari(r.resign);
    return resign !== null && resign >= mulai && resign <= selesai;
  }).length;
}

const persenDari = (keluar: number, headcount: number): number =>
  headcount <= 0 ? 0 : Math.round((keluar / headcount) * 1000) / 10;

/**
 * Turnover bulanan untuk `bulan` bulan terakhir, yang terlama di depan.
 *
 * Urutannya menaik karena hasilnya digambar sebagai garis, dan garis waktu yang
 * bergerak mundur ke kanan membuat kenaikan terbaca sebagai penurunan.
 */
export function turnoverBulanan(rows: RiwayatKerja[], sampai: Date, bulan = 6): TitikTurnover[] {
  const hasil: TitikTurnover[] = [];
  for (let i = bulan - 1; i >= 0; i--) {
    const t = new Date(Date.UTC(sampai.getUTCFullYear(), sampai.getUTCMonth() - i, 1));
    const y = t.getUTCFullYear();
    const m = t.getUTCMonth();
    const mulai = awalBulan(y, m);
    const selesai = akhirBulan(y, m);
    const keluar = keluarAntara(rows, mulai, selesai);
    // Rata-rata awal dan akhir bulan — lihat catatan di kepala berkas.
    const headcount = Math.round((headcountPada(rows, mulai) + headcountPada(rows, selesai)) / 2);
    hasil.push({
      bulan: `${y}-${String(m + 1).padStart(2, "0")}`,
      keluar,
      headcount,
      persen: persenDari(keluar, headcount),
    });
  }
  return hasil;
}

/** Turnover sejak 1 Januari tahun berjalan sampai hari ini. */
export function turnoverYtd(rows: RiwayatKerja[], sekarang: Date): TitikTurnover {
  const tahun = sekarang.getUTCFullYear();
  const mulai = Date.UTC(tahun, 0, 1);
  const kini = Date.UTC(tahun, sekarang.getUTCMonth(), sekarang.getUTCDate());
  const keluar = keluarAntara(rows, mulai, kini);
  const headcount = Math.round((headcountPada(rows, mulai) + headcountPada(rows, kini)) / 2);
  return { bulan: String(tahun), keluar, headcount, persen: persenDari(keluar, headcount) };
}
