/**
 * WEEKLY PERFORMANCE — grain OUTLET × WEEK, dan tidak pernah punya target.
 *
 * ┌─ TIGA HAL YANG DIKUNCI GATE M DAN GATE N ────────────────────────────────┐
 * │                                                                          │
 * │  1. TIDAK ADA WEEKLY TARGET. Monthly Target tetap satu-satunya target    │
 * │     resmi, dan ia hanya boleh muncul di sini sebagai KONTEKS berlabel    │
 * │     bulan. Tidak ada `weekly_target`, `weekly_achievement`, maupun       │
 * │     `weekly_gap` — dan tidak ada satu pun pembagian target bulanan ke    │
 * │     dalam minggu, baik dibagi jumlah minggu maupun dibagi hari kalender. │
 * │                                                                          │
 * │  2. TIDAK ADA WEEKLY SIGNAL. Seluruh 341 Signal produksi berskala        │
 * │     `bulanan`, dan tidak satu pun kolomnya menyatakan kapan pelanggaran  │
 * │     itu terjadi DI DALAM bulan. Menempelkannya ke minggu berarti         │
 * │     mengarang informasi yang tidak pernah ada.                           │
 * │                                                                          │
 * │  3. KOSONG BUKAN NOL. Itu sebabnya seluruh angka di berkas ini bertipe   │
 * │     `Terukur`, bukan `number | null` — lihat catatan di bawah.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ KENAPA `Terukur`, BUKAN `number | null` ────────────────────────────────┐
 * │                                                                          │
 * │ `number | null` menjawab "ada angkanya?" tapi tidak pernah menjawab      │
 * │ "kenapa tidak ada?". Dua null yang berbeda sebabnya menuntut tindakan    │
 * │ yang berbeda jauh:                                                       │
 * │                                                                          │
 * │   pax belum ditarik ESB      → tunggu cron                               │
 * │   outlet belum punya cabang  → pasangkan di Manajemen Outlet             │
 * │   minggu sebelumnya tak ada  → memang belum ada pembandingnya            │
 * │   struk nol                  → periksa apakah outletnya memang tutup     │
 * │                                                                          │
 * │ Dan `number | null` terlalu mudah diredam jadi nol: satu `?? 0` yang     │
 * │ lolos review sudah cukup untuk mengubah "belum terukur" jadi "tidak      │
 * │ berjualan". `Terukur` tidak punya bentuk numerik yang bisa di-`??`;      │
 * │ yang membacanya HARUS memeriksa `diketahui` lebih dulu, dan TypeScript   │
 * │ yang memaksanya. 669 dari 2.736 baris `seasonal_daily` Agustus–September │
 * │ tidak punya pax/bills — kalau itu terbaca nol, 53 outlet diumumkan tidak │
 * │ kedatangan tamu.                                                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * MURNI — tanpa basis data, tanpa `server-only`, tanpa `await`.
 */

import type { RentangMinggu } from "@/lib/kpi/minggu";

/* ───────────────────────────── ketidaktahuan ───────────────────────────── */

/**
 * Kenapa sebuah angka tidak diketahui.
 *
 * Kodenya ikut sampai ke layar, jadi yang membacanya tahu apa yang harus
 * dikerjakan — bukan cuma tahu bahwa ada yang kosong.
 */
export type AlasanTakTahu =
  /** Barisnya tidak ada, atau ada tapi kolomnya NULL. */
  | "data_tidak_tersedia"
  /** Outlet ini belum dipasangkan ke cabang ESB, jadi tidak pernah terukur. */
  | "tanpa_cabang"
  /** Tidak ada minggu sebelumnya untuk dibandingkan. */
  | "tanpa_minggu_sebelumnya"
  /** Penyebutnya nol atau negatif — pembagiannya tidak sah. */
  | "penyebut_tidak_sah"
  /** Struk nol. Mungkin benar-benar tutup, mungkin datanya belum masuk. */
  | "tanpa_struk"
  /** Outlet belum genap tiga bulan, jadi memang belum punya target. */
  | "tanpa_target"
  /** `outlets.esb_mulai` / `esb_abaikan` menyatakan angka bulan ini tidak sah. */
  | "sumber_tidak_sah";

/**
 * Sebuah angka yang mungkin tidak ada — dan kalau tidak ada, ada alasannya.
 *
 * Sengaja TIDAK punya properti numerik di cabang `diketahui: false`. Bentuk itu
 * yang membuat `nilai ?? 0` tidak bisa ditulis sama sekali.
 */
export type Terukur =
  | { readonly diketahui: true; readonly nilai: number }
  | { readonly diketahui: false; readonly alasan: AlasanTakTahu };

export const terukur = (nilai: number): Terukur => ({ diketahui: true, nilai });
export const takTahu = (alasan: AlasanTakTahu): Terukur => ({ diketahui: false, alasan });

/**
 * Bungkus angka yang boleh null.
 *
 * `0` LOLOS sebagai angka yang diketahui, dan itu inti berkas ini: nol struk
 * adalah pengukuran, bukan ketiadaan. Yang tidak lolos cuma `null`, `undefined`,
 * dan angka yang tidak terhingga.
 */
export function dariNullable(v: number | null | undefined, alasan: AlasanTakTahu = "data_tidak_tersedia"): Terukur {
  if (v === null || v === undefined || !Number.isFinite(v)) return takTahu(alasan);
  return terukur(v);
}

/** Angkanya kalau diketahui; `null` kalau tidak. Untuk pemformatan, BUKAN untuk berhitung. */
export const nilaiAtauNull = (t: Terukur): number | null => (t.diketahui ? t.nilai : null);

/* ───────────────────────────── perhitungan ───────────────────────────── */

/**
 * Pertumbuhan terhadap minggu sebelumnya, dalam persen.
 *
 * Urutan pemeriksaannya disengaja, karena alasan yang dilaporkan harus alasan
 * yang paling berguna:
 *
 *   1. minggu sebelumnya tidak ada  → `tanpa_minggu_sebelumnya`
 *   2. minggu sebelumnya ≤ 0        → `penyebut_tidak_sah`
 *   3. minggu ini tidak ada         → alasannya sendiri, diteruskan apa adanya
 *
 * Nomor 2 bukan kehati-hatian berlebihan. Penyebut nol menghasilkan `Infinity`
 * di JavaScript, dan `Infinity` diformat jadi "∞%" atau — lebih buruk — jadi
 * angka besar yang terlihat seperti lonjakan sungguhan.
 */
export function pertumbuhan(kini: Terukur, lalu: Terukur): Terukur {
  if (!lalu.diketahui) return takTahu("tanpa_minggu_sebelumnya");
  if (lalu.nilai <= 0) return takTahu("penyebut_tidak_sah");
  if (!kini.diketahui) return takTahu(kini.alasan);
  return terukur(((kini.nilai - lalu.nilai) / lalu.nilai) * 100);
}

/**
 * Rata-rata transaksi — net dibagi jumlah struk.
 *
 * `bills = 0` TIDAK menghasilkan angka, dan itu pembedaan yang paling mudah
 * dilanggar di seluruh kontrak ini. Nol struk berarti tidak ada satu transaksi
 * pun minggu itu; membaginya menghasilkan `Infinity`, dan membiarkannya jadi 0
 * mengumumkan "rata-rata transaksi Rp 0" untuk outlet yang barangkali cuma
 * belum ditarik datanya.
 */
export function rataTransaksi(net: Terukur, bills: Terukur): Terukur {
  if (!bills.diketahui) return takTahu(bills.alasan);
  if (bills.nilai === 0) return takTahu("tanpa_struk");
  if (bills.nilai < 0) return takTahu("penyebut_tidak_sah");
  if (!net.diketahui) return takTahu(net.alasan);
  return terukur(net.nilai / bills.nilai);
}

/**
 * Kelengkapan data satu minggu, 0–100.
 *
 * Pembilangnya HARI YANG SUDAH IKUT TERHITUNG, bukan hari yang sudah lewat.
 * Bedanya yang membuat minggu yang baru berjalan dua hari tidak terbaca sebagai
 * minggu yang jeblok — keduanya berangka kecil, dan cuma yang pertama layak
 * dibaca sebagai kegagalan.
 */
export function kelengkapan(hariAda: number, hariMinggu: number): Terukur {
  if (hariMinggu <= 0) return takTahu("data_tidak_tersedia");
  const n = Math.max(0, Math.min(hariAda, hariMinggu));
  return terukur((n / hariMinggu) * 100);
}

/* ───────────────────────────── bentuk masukan ───────────────────────────── */

/** Satu minggu satu outlet, apa adanya dari `esb_net_mingguan`. */
export interface MingguMentah {
  /** Nomor minggu dalam bulannya, 1–5. */
  minggu: number;
  /** Panjang minggu itu menurut kalender: 7, atau 2–3 untuk minggu terakhir. */
  hariMinggu: number;
  /** Berapa harinya yang sudah ikut terhitung. */
  hariAda: number;
  net: number | null;
  pax: number | null;
  bills: number | null;
}

/** Satu outlet beserta seluruh minggunya. */
export interface SumberMingguan {
  outletId: string;
  nama: string;
  kode: string;
  /** Area GEOGRAFIS (`outlets.area_id`). Bukan nama coordinator. */
  area: string;
  /** Coordinator Area yang DITUGASI outlet ini (`users.outlet_ids`). */
  coordinator: string;
  /** Cabang ESB-nya. Null berarti tidak pernah terukur mingguan. */
  cabang: string | null;
  /** Sejajar dengan pembagian minggu bulan itu, urut minggu ke-1 dst. */
  minggu: MingguMentah[];
  /**
   * Minggu TERAKHIR bulan sebelumnya — pembanding bagi minggu ke-1.
   *
   * Null bila bulan sebelumnya tidak punya barisnya sama sekali. Perhatikan
   * panjangnya bisa 2–3 hari sementara minggu ke-1 selalu 7; itulah sebabnya
   * `sebanding` ada.
   */
  mingguLalu: MingguMentah | null;
  /** Angka ESB bulan ini sudah dinyatakan sah untuk outlet ini? */
  sumberSah: boolean;
  /** Target BULANAN outlet ini — KONTEKS, bukan dasar perhitungan mingguan. */
  targetBulanan: number | null;
}

/* ───────────────────────────── bentuk hasil ───────────────────────────── */

export interface SelMingguan {
  minggu: number;
  hariMinggu: number;
  hariAda: number;
  sales: Terukur;
  pax: Terukur;
  bills: Terukur;
  rataTransaksi: Terukur;
  /** Persen terhadap minggu SEBELUMNYA. */
  pertumbuhan: Terukur;
  /**
   * Kedua minggu yang dibandingkan sama banyak hari terisinya?
   *
   * Minggu ke-1 (7 hari) dibandingkan minggu terakhir bulan lalu (2–3 hari)
   * selalu melonjak ratusan persen tanpa ada yang benar-benar naik; minggu
   * berjalan yang baru terisi dua hari selalu terlihat anjlok. Angkanya tetap
   * dihitung — ia bukan karangan — tapi ia WAJIB ditandai, dan yang menampilkan
   * tidak boleh menyembunyikan tanda ini.
   */
  sebanding: boolean;
  kelengkapan: Terukur;
}

export interface BarisMingguan {
  outletId: string;
  nama: string;
  kode: string;
  area: string;
  coordinator: string;
  cabang: string | null;
  sel: SelMingguan[];
  /**
   * Target bulanan sebagai KONTEKS.
   *
   * Tidak pernah dibagi, tidak pernah dibandingkan dengan angka mingguan, dan
   * tidak pernah melahirkan persentase capaian di tingkat minggu.
   */
  targetBulananKonteks: Terukur;
  /** Rata-rata kelengkapan seluruh minggu yang sudah dimulai. */
  kelengkapanBulan: Terukur;
  sumberSah: boolean;
}

/* ───────────────────────────── penyusunan ───────────────────────────── */

/** Bungkus satu minggu mentah jadi tiga angka terukur. */
function angkaMinggu(m: MingguMentah | null, cabang: string | null, sumberSah: boolean) {
  const kosong = cabang === null ? takTahu("tanpa_cabang") : !sumberSah ? takTahu("sumber_tidak_sah") : null;
  if (kosong) return { sales: kosong, pax: kosong, bills: kosong };
  if (m === null) {
    const t = takTahu("data_tidak_tersedia");
    return { sales: t, pax: t, bills: t };
  }
  return { sales: dariNullable(m.net), pax: dariNullable(m.pax), bills: dariNullable(m.bills) };
}

/**
 * Susun satu baris Weekly Performance.
 *
 * TIDAK MEMANGGIL `barisHarian`, `targetMinggu`, maupun `hitungBarisMinggu`.
 * Ketiganya menurunkan target mingguan dari target bulanan, dan itu yang
 * dilarang Gate M — lihat `src/lib/data/mingguan-performa.test.ts` yang membaca
 * berkas ini baris per baris untuk memastikannya.
 */
export function barisMingguan(s: SumberMingguan): BarisMingguan {
  const lalu = angkaMinggu(s.mingguLalu, s.cabang, s.sumberSah);

  const sel: SelMingguan[] = s.minggu.map((m, i) => {
    const kini = angkaMinggu(m, s.cabang, s.sumberSah);

    // Pembandingnya minggu SEBELUMNYA di sumbu waktu: minggu ke-N−1 dalam bulan
    // yang sama, dan untuk minggu ke-1 minggu terakhir bulan sebelumnya.
    const sebelum = i === 0 ? s.mingguLalu : s.minggu[i - 1];
    const angkaSebelum = i === 0 ? lalu : angkaMinggu(s.minggu[i - 1], s.cabang, s.sumberSah);

    return {
      minggu: m.minggu,
      hariMinggu: m.hariMinggu,
      hariAda: m.hariAda,
      sales: kini.sales,
      pax: kini.pax,
      bills: kini.bills,
      rataTransaksi: rataTransaksi(kini.sales, kini.bills),
      pertumbuhan: pertumbuhan(kini.sales, angkaSebelum.sales),
      sebanding: sebelum !== null && sebelum.hariAda > 0 && sebelum.hariAda === m.hariAda,
      kelengkapan: kelengkapan(m.hariAda, m.hariMinggu),
    };
  });

  // Hanya minggu yang SUDAH DIMULAI yang ikut dirata-rata. Minggu yang belum
  // datang bukan minggu yang datanya hilang.
  const dimulai = s.minggu.filter((m) => m.hariAda > 0 || m.net !== null);
  const kelengkapanBulan =
    s.cabang === null
      ? takTahu("tanpa_cabang")
      : dimulai.length === 0
        ? takTahu("data_tidak_tersedia")
        : terukur(
            (dimulai.reduce((n, m) => n + Math.min(m.hariAda, m.hariMinggu), 0) /
              dimulai.reduce((n, m) => n + m.hariMinggu, 0)) *
              100,
          );

  return {
    outletId: s.outletId,
    nama: s.nama,
    kode: s.kode,
    area: s.area,
    coordinator: s.coordinator,
    cabang: s.cabang,
    sel,
    targetBulananKonteks: dariNullable(s.targetBulanan, "tanpa_target"),
    kelengkapanBulan,
    sumberSah: s.sumberSah,
  };
}

/** Susun seluruh outlet, urut nama supaya tabelnya stabil antar-pemuatan. */
export function susunMingguan(sumber: readonly SumberMingguan[]): BarisMingguan[] {
  return sumber.map(barisMingguan).sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

/** Pembagian minggu bulan itu, dipakai bersama tabelnya. */
export const labelMingguan = (m: RentangMinggu): string => `M${m.minggu}`;
export const rentangMingguan = (m: RentangMinggu): string =>
  `${String(m.dari).padStart(2, "0")}–${String(m.sampai).padStart(2, "0")}`;
