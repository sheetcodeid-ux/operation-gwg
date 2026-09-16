import { bulanSebelum } from "./waktu";

/**
 * TARGET PENJUALAN BULANAN — aturannya, tanpa basis data.
 *
 * Aturannya sudah berlaku di produksi lewat `targetBulananOutlet()`
 * (`src/lib/data/kpi.ts`): rata-rata tiga bulan penuh sebelumnya, dikalikan
 * satu tambah laju pertumbuhan, dan outlet yang belum genap tiga bulan tidak
 * diberi target sama sekali.
 *
 * ┌─ KENAPA ATURANNYA ADA DI DUA BERKAS ─────────────────────────────────────┐
 * │                                                                          │
 * │ Yang di `src/lib/data/kpi.ts` menempel pada Supabase, pada SEED di       │
 * │ memori, dan pada `server-only`. Ia tidak bisa dipanggil dari uji yang    │
 * │ tidak punya basis data, dan tidak bisa dipanggil dari skrip rekonsiliasi │
 * │ yang berjalan di basis data lokal.                                       │
 * │                                                                          │
 * │ Memindahkannya ke sini berarti membongkar `angkaCa`, `grossOutlet`, dan  │
 * │ tiga uji yang membaca kode sumbernya baris per baris — pekerjaan yang    │
 * │ menyentuh KPI Coordinator Area yang sedang melayani produksi, dan itu    │
 * │ bukan pekerjaan phase ini.                                               │
 * │                                                                          │
 * │ Jadi aturannya memang ditulis dua kali, DENGAN PENJAGA: `target-sales.   │
 * │ test.ts` membaca kedua berkas dan gagal begitu keduanya tidak lagi       │
 * │ sepakat — soal angka batas tanggal buka, soal rumus pertumbuhan, dan     │
 * │ soal bulan mana yang dipakai. Duplikat yang dijaga masih bisa            │
 * │ dipertanggungjawabkan; duplikat yang didiamkan tidak.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * LAJU PERTUMBUHANNYA TIDAK DITULIS DI SINI. Angka 15 hidup di indikator
 * `gross_sales` posisi `operational_ca` (`src/lib/kpi/indikator.ts`) dan bisa
 * diubah lewat halaman pengaturan KPI. Menuliskannya sebagai tetapan di sini
 * berarti target V.1 diam-diam berbeda dari target yang dilihat Coordinator
 * Area begitu angkanya diubah. Jadi ia WAJIB disuntikkan.
 */

/* ───────────────────────────── bentuk data ───────────────────────────── */

/** Yang perlu diketahui tentang sebuah outlet untuk menghitung targetnya. */
export interface OutletTarget {
  id: string;
  /** Tanggal buka, "YYYY-MM-DD". Null bila belum diisi. */
  bukaTanggal: string | null;
}

export interface MasukanTarget {
  /** Bulan yang ditargetkan, "YYYY-MM". */
  periode: string;
  outlets: readonly OutletTarget[];
  /**
   * Gross sales tiga bulan sebelumnya: "outletId|YYYY-MM" → angka.
   *
   * Null dan nilai yang tidak ada dibedakan dari nol dengan sengaja — lihat
   * `berjalan()` di bawah.
   */
  riwayat: ReadonlyMap<string, number | null>;
  /** Persen, mis. 15 untuk 15%. Datang dari indikatornya, bukan dari sini. */
  pertumbuhan: number;
}

/** Target satu outlet, beserta seluruh angka yang membentuknya. */
export interface HasilTarget {
  outletId: string;
  /** Null berarti outlet ini memang belum boleh diberi target. */
  nilai: number | null;
  /** Kenapa nilainya null — kosong bila ada targetnya. */
  alasan: "belum-tiga-bulan" | "tanpa-riwayat" | null;
  /** Tiga bulan yang dipakai, terbaru dulu. */
  bulan: string[];
  /** Angka tiap bulan, sejajar dengan `bulan`. */
  riwayat: (number | null)[];
  /** Yang benar-benar ikut dirata-rata. */
  dipakai: number[];
  pertumbuhan: number;
}

/* ─────────────────────────────── aturan ─────────────────────────────── */

/**
 * Tanggal paling akhir dalam sebulan yang masih membuat bulan itu terhitung
 * sebagai bulan berjalan.
 *
 * Sama persis dengan `TANGGAL_BATAS_BUKA` di `src/lib/data/kpi.ts`, dan
 * dijaga oleh uji supaya tetap sama. Outlet yang buka tanggal 31 berjalan satu
 * hari di bulan itu; menghitungnya sebagai bulan penuh membuatnya dinilai
 * sebulan lebih awal daripada seharusnya.
 */
export const TANGGAL_BATAS_BUKA = 15;

/** Nama rumus yang ikut disimpan bersama tiap target. */
export const RUMUS_TARGET = "avg3-tumbuh";
/** Naik bila cara menghitungnya berubah, bukan bila angkanya berubah. */
export const RUMUS_TARGET_VERSI = 1;

/** Tiga bulan sebelum `periode`, terbaru dulu. */
export function tigaBulanSebelum(periode: string): string[] {
  const a = bulanSebelum(periode);
  const b = bulanSebelum(a);
  return [a, b, bulanSebelum(b)];
}

/** Bulan pertama yang terhitung sebagai bulan berjalan bagi satu outlet. */
export function bulanMulaiBerjalan(bukaTanggal: string | null): string | null {
  if (!bukaTanggal) return null;
  const cocok = /^(\d{4})-(\d{2})-(\d{2})/.exec(bukaTanggal);
  if (!cocok) return null;
  const [, th, bl, tg] = cocok;
  const bulan = `${th}-${bl}`;
  return Number(tg) <= TANGGAL_BATAS_BUKA ? bulan : bulanSesudahBulan(bulan);
}

const bulanSesudahBulan = (periode: string): string => {
  const [th, bl] = periode.split("-").map(Number);
  return bl === 12 ? `${th + 1}-01` : `${th}-${String(bl + 1).padStart(2, "0")}`;
};

/**
 * Bulan itu benar-benar berjalan bagi outlet ini — bukan sekadar ada barisnya.
 *
 * NOL DARI ESB BUKAN "penjualannya nol", melainkan "cabang ini belum ada di
 * bulan itu". ESB tetap membalas untuk cabang yang belum buka, dan balasannya
 * nol, jadi barisnya selalu tersimpan. Kalau nol dianggap sah, outlet yang
 * belum buka lolos aturan tiga bulan dengan penjualan nol dan menyeret
 * rata-rata seluruh area ke bawah.
 */
const berjalan = (nilai: number | null | undefined): boolean => nilai !== null && nilai !== undefined && nilai > 0;

/**
 * Outlet ini sudah genap tiga bulan berjalan sebelum `periode`?
 *
 * DUA CARA, dan yang pertama menang bila datanya ada. Tanggal buka adalah
 * jawaban yang sebenarnya; ada-tidaknya penjualan hanyalah tebakan yang dipakai
 * selama tanggalnya belum diisi — dan tebakan itulah yang meloloskan outlet
 * yang buka di akhir bulan.
 */
export function sudahTigaBulan(
  o: OutletTarget,
  periode: string,
  nilaiTigaBulan: readonly (number | null)[],
): boolean {
  const mulai = bulanMulaiBerjalan(o.bukaTanggal);
  if (mulai) return mulai <= tigaBulanSebelum(periode)[2];
  return nilaiTigaBulan.every(berjalan);
}

/* ─────────────────────────────── hitungan ─────────────────────────────── */

/**
 * Target seluruh outlet untuk satu bulan.
 *
 * Outlet yang tidak berhak diberi target tetap dikembalikan, dengan `nilai`
 * null dan `alasan` terisi. Membuangnya diam-diam membuat "outlet ini belum
 * dinilai" tidak bisa dibedakan dari "outlet ini terlewat dihitung", dan yang
 * kedua adalah kegagalan yang harus kelihatan.
 */
export function hitungTargetSales(m: MasukanTarget): HasilTarget[] {
  const bulan = tigaBulanSebelum(m.periode);
  return m.outlets.map((o) => {
    const riwayat = bulan.map((b) => m.riwayat.get(`${o.id}|${b}`) ?? null);
    const dasar: HasilTarget = {
      outletId: o.id,
      nilai: null,
      alasan: null,
      bulan,
      riwayat,
      dipakai: [],
      pertumbuhan: m.pertumbuhan,
    };

    if (!sudahTigaBulan(o, m.periode, riwayat)) return { ...dasar, alasan: "belum-tiga-bulan" };

    // Bulan yang angkanya nol atau kosong TIDAK ikut dirata-rata. Ikut
    // menghitungnya berarti outlet yang satu bulannya tidak tertarik datanya
    // mendapat target sepertiga lebih rendah — hadiah untuk data yang hilang.
    const dipakai = riwayat.filter((v): v is number => berjalan(v));
    if (dipakai.length === 0) return { ...dasar, alasan: "tanpa-riwayat" };

    const rata = dipakai.reduce((a, b) => a + b, 0) / dipakai.length;
    return { ...dasar, nilai: rata * (1 + m.pertumbuhan / 100), dipakai };
  });
}
