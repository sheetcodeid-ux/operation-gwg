/**
 * Penjualan HARI DEMI HARI dalam satu bulan, per outlet.
 *
 * Angka bulanan menjawab "berapa", angka harian menjawab "kapan". Outlet yang
 * turun 20% sebulan bisa berarti dua hal yang sama sekali berbeda: turun
 * sedikit tiap hari, atau tutup empat hari. Keduanya terbaca sama di laporan
 * bulanan, dan yang harus dikerjakan Coordinator Area berbeda jauh.
 *
 * Berkas ini hanya BERHITUNG — tidak menyentuh basis data dan tidak tahu siapa
 * yang membacanya, supaya seluruh aturannya bisa diuji tanpa ESB.
 */

/** Satu hari dalam bulan itu. */
export interface HariKolom {
  /** Tanggal 1–31. */
  tanggal: number;
  /** Nama hari pendek: SEN, SEL, RAB, KAM, JUM, SAB, MIN. */
  hari: string;
  /** Sabtu atau Minggu — ditandai supaya pola akhir pekan terbaca. */
  pekan: boolean;
}

const NAMA_HARI = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"] as const;

/** Jumlah hari dalam sebuah bulan "YYYY-MM". */
export function jumlahHari(periode: string): number {
  const [th, bl] = periode.split("-").map(Number);
  return new Date(Date.UTC(th, bl, 0)).getUTCDate();
}

/** Kolom hari sebuah bulan, urut tanggal 1 sampai akhir. */
export function kolomHari(periode: string): HariKolom[] {
  const [th, bl] = periode.split("-").map(Number);
  return Array.from({ length: jumlahHari(periode) }, (_, i) => {
    const d = new Date(Date.UTC(th, bl - 1, i + 1));
    const w = d.getUTCDay();
    return { tanggal: i + 1, hari: NAMA_HARI[w], pekan: w === 0 || w === 6 };
  });
}

export interface SumberHarian {
  outletId: string;
  nama: string;
  /** Keterangan di bawah namanya — siapa yang memegang outlet ini. */
  area: string;
  /** Penjualan tiap tanggal; null = belum ditarik dari ESB. */
  hari: (number | null)[];
  /** Penjualan tiap tanggal BULAN LALU — pembanding yang setara. */
  hariLalu: (number | null)[];
  /**
   * Penjualan HARI TERAKHIR bulan lalu.
   *
   * Dipakai satu-satunya tempat yang tidak punya "hari sebelumnya": tanggal 1.
   * Tanpa ini kolom pertama selalu kosong persentasenya, padahal justru
   * pergantian bulan yang paling sering ditanyakan — apakah awal bulan ini
   * mulai lebih baik daripada akhir bulan lalu.
   */
  akhirBulanLalu?: number | null;
}

export interface BarisHarian extends SumberHarian {
  /** Jumlah seluruh hari yang sudah ada angkanya. */
  bulanIni: number | null;
  /**
   * Jumlah bulan lalu SEPANJANG HARI YANG SAMA.
   *
   * Bukan bulan lalu penuh. Tanggal 14 dibandingkan dengan sebulan penuh selalu
   * menghasilkan minus delapan puluh persen, untuk SETIAP outlet, setiap bulan
   * — angka yang tidak pernah salah dan tidak pernah berguna. Yang dibandingkan
   * tanggal 1–14 bulan ini dengan tanggal 1–14 bulan lalu.
   */
  bulanLalu: number | null;
  /** Perubahan terhadap `bulanLalu`, dalam persen. */
  mom: number | null;
  /** Perubahan tiap hari terhadap HARI SEBELUMNYA, dalam persen. */
  ubah: (number | null)[];
}

/** Perubahan b terhadap a dalam persen; null bila salah satunya tidak ada. */
export function bandingHarian(a: number | null, b: number | null): number | null {
  if (a === null || b === null || a <= 0) return null;
  return ((b - a) / a) * 100;
}

const jumlahAda = (v: (number | null)[]): number | null => {
  const ada = v.filter((n): n is number => n !== null);
  return ada.length ? ada.reduce((x, y) => x + y, 0) : null;
};

/**
 * Satu baris tabel harian.
 *
 * Hari yang BELUM DITARIK dibiarkan null, tidak dijadikan nol. Nol berarti
 * outlet itu tidak berjualan sehari penuh — tuduhan yang berbeda jauh dari
 * "angkanya belum sampai", dan yang membacanya akan menelepon outlet yang
 * sebenarnya baik-baik saja.
 */
export function barisHarian(s: SumberHarian): BarisHarian {
  const bulanIni = jumlahAda(s.hari);
  // Pembandingnya dipotong sepanjang hari yang SUDAH ada angkanya bulan ini.
  const sejauhIni = s.hari.reduce<number>((n, v, i) => (v === null ? n : i + 1), 0);
  const bulanLalu = jumlahAda(s.hariLalu.slice(0, sejauhIni));

  const ubah = s.hari.map((v, i) =>
    i === 0 ? bandingHarian(s.akhirBulanLalu ?? null, v) : bandingHarian(s.hari[i - 1], v),
  );
  return { ...s, bulanIni, bulanLalu, mom: bandingHarian(bulanLalu, bulanIni), ubah };
}

/** Seluruh baris, terbesar lebih dulu — yang paling besar paling dulu dibaca. */
export const urutHarian = (baris: BarisHarian[]): BarisHarian[] =>
  [...baris].sort((a, b) => (b.bulanIni ?? -1) - (a.bulanIni ?? -1));

/** Baris gabungan seluruh outlet — dijumlah per tanggal, bukan dirata-rata. */
export function totalHarian(baris: BarisHarian[], nama = "Seluruh outlet"): BarisHarian | null {
  if (baris.length === 0) return null;
  const panjang = baris[0].hari.length;
  const jumlahKolom = (ambil: (b: BarisHarian) => (number | null)[]) =>
    Array.from({ length: panjang }, (_, i) => jumlahAda(baris.map((b) => ambil(b)[i] ?? null)));
  const akhir = baris.map((b) => b.akhirBulanLalu ?? null).filter((n): n is number => n !== null);
  return barisHarian({
    outletId: "__total__",
    nama,
    area: `${baris.length} outlet`,
    hari: jumlahKolom((b) => b.hari),
    hariLalu: jumlahKolom((b) => b.hariLalu),
    akhirBulanLalu: akhir.length ? akhir.reduce((a, b) => a + b, 0) : null,
  });
}
