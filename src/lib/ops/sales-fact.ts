import type { Outlet } from "@/lib/types";

/**
 * SATU PINTU BACA PENJUALAN UNTUK OPERATIONAL V.1.
 *
 * Sumbernya `seasonal_daily`, dan itu tidak berubah. Yang diatur di sini CARA
 * membacanya — karena tabel itu memuat dua hal yang bukan penjualan outlet, dan
 * keduanya tidak kelihatan dari nama kolomnya.
 *
 * ┌─ BARIS KORPORAT ────────────────────────────────────────────────────────┐
 * │ `branch = ''` — 348 hari, Desember 2024 sampai September 2026,          │
 * │ Rp 118.092.066.971. Bukan cabang: `syncSeasonalDays()` berparameter     │
 * │ `branch = ""` (`src/lib/data/seasonal.ts:100`), dan ESB membaca string  │
 * │ kosong sebagai "seluruh cabang". Hasilnya disimpan seperti baris cabang │
 * │ biasa.                                                                  │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ CABANG YATIM ──────────────────────────────────────────────────────────┐
 * │ `57-fnb_nord` — 78 hari, Juni sampai September 2026, Rp 164.030.635,    │
 * │ tidak cocok dengan satu outlet pun.                                     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Akibatnya `SUM(net) FROM seasonal_daily` MENGHITUNG GANDA. Diuji pada Agustus
 * 2026: 48 cabang cocok persis dengan `esb_net_bulanan`, 10 beda tipis (selisih
 * total Rp 25.002 — kedatangan data yang terlambat), dan dua baris di atas
 * menambahkan Rp 13,4 miliar yang seharusnya tidak ikut. Totalnya jadi dua kali
 * lipat.
 *
 * Halaman Daily tidak terkena karena menyaring lewat daftar cabang yang
 * diturunkan dari outlet (`src/lib/data/daily-outlet.ts:139`). Yang akan
 * terkena adalah query V.1 yang ditulis belakangan oleh orang yang menganggap
 * tabel itu berisi cabang saja — dan salahnya tidak akan terlihat, karena
 * angkanya tetap masuk akal.
 *
 * BARIS KORPORAT ITU SENDIRI BUKAN CACAT. Ia sengaja disimpan dan dipakai
 * halaman Musiman. Yang perlu dijaga cara membacanya, bukan datanya — jadi
 * tidak ada baris yang dihapus, tidak ada tabel yang diubah, tidak ada sumber
 * penjualan kedua yang dibuat.
 *
 * ATURANNYA SATU KALIMAT:
 *
 *   Baris `seasonal_daily` hanya masuk penjualan outlet V.1 bila `branch`-nya
 *   cocok dengan `esb_branch_id` milik outlet aktif.
 *
 * MURNI — tanpa basis data. Barisnya disuntikkan pemanggil, jadi aturan ini
 * bisa diuji tanpa Supabase. Pembacaan basis datanya ada di lapisan data
 * (`src/lib/data/*`), yang memakai peta dari sini sebagai penyaring.
 */

/* ─────────────────────────── bentuk data ─────────────────────────── */

/** Satu baris mentah `seasonal_daily`, seperti apa adanya dari basis data. */
export interface BarisSeasonal {
  branch: string | null;
  day: string;
  net: number | string | null;
  gross?: number | string | null;
  pax?: number | null;
  bills?: number | null;
}

/** Satu fakta penjualan yang sudah dipastikan milik sebuah outlet. */
export interface FaktaPenjualan {
  outletId: string;
  branch: string;
  /** "YYYY-MM-DD". */
  tanggal: string;
  net: number;
  gross: number | null;
  pax: number | null;
  bills: number | null;
}

/** Kenapa sebuah baris tidak ikut — dihitung, bukan dibuang diam-diam. */
export interface BarisDibuang {
  /** Baris korporat `branch = ''` atau null. */
  korporat: number;
  /** Cabang yang tidak dimiliki outlet aktif mana pun. */
  yatim: number;
  /** Tanggal tidak berbentuk YYYY-MM-DD, atau net bukan angka. */
  cacat: number;
  /** Cabang yatim yang ditemui, untuk dilaporkan. */
  cabangYatim: string[];
}

export interface HasilFakta {
  fakta: FaktaPenjualan[];
  dibuang: BarisDibuang;
}

/* ──────────────────────── peta cabang → outlet ──────────────────────── */

/**
 * Cabang ESB → outlet yang memilikinya.
 *
 * HANYA outlet aktif yang punya `esbBranchId`. Outlet tanpa cabang tidak masuk
 * peta, jadi ia tidak akan pernah dipaksa punya penjualan — kalau suatu hari
 * ada baris `seasonal_daily` yang entah bagaimana menyebut outlet itu, baris
 * tersebut tetap dibuang sebagai yatim.
 *
 * Aturan yang sama dipakai `cabangDaily()`
 * (`src/lib/data/kelengkapan-daily.ts`) dan halaman Daily. Sengaja ditulis
 * ulang di sini dalam bentuk PETA, bukan daftar: V.1 butuh tahu baris ini milik
 * outlet mana, bukan sekadar "cabangnya sah". Daftarnya sendiri tetap bisa
 * diambil lewat `cabangTerpetakan()` supaya kedua bentuk itu tidak pernah
 * berbeda isinya.
 */
export function petaCabangOutlet(outlets: readonly Outlet[]): Map<string, string> {
  const peta = new Map<string, string>();
  for (const o of outlets) {
    if (!o.active) continue;
    const b = o.esbBranchId?.trim();
    if (!b) continue;
    // Cabang yang dipakai dua outlet: yang PERTAMA menang, dan itu disebut di
    // sini supaya tidak dikira acak. Keadaan ini semestinya tidak ada; kalau
    // muncul, ia terbaca sebagai penjualan yang hilang dari outlet kedua —
    // bukan penjualan ganda.
    if (!peta.has(b)) peta.set(b, o.id);
  }
  return peta;
}

/** Daftar cabang yang sah, untuk penyaring query (`.in("branch", …)`). */
export function cabangTerpetakan(outlets: readonly Outlet[]): string[] {
  return [...petaCabangOutlet(outlets).keys()];
}

/** Outlet aktif yang BELUM punya cabang ESB — disebut, tidak didiamkan. */
export function outletTanpaCabang(outlets: readonly Outlet[]): Outlet[] {
  return outlets.filter((o) => o.active && !o.esbBranchId?.trim());
}

/* ─────────────────────────── penyaringan ─────────────────────────── */

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Saring baris mentah jadi fakta penjualan outlet.
 *
 * INI SATU-SATUNYA TEMPAT aturan pembuangan ditulis. Fitur V.1 yang membutuhkan
 * penjualan memanggil ini, bukan menyaring sendiri.
 *
 * `net` nol adalah angka yang SAH — outlet yang buka tapi tidak menjual apa pun
 * tetap punya baris. Yang tidak sah adalah baris yang net-nya bukan angka sama
 * sekali. Menyamakan keduanya membuat hari sepi terbaca sebagai hari yang
 * datanya belum ditarik, dan sebaliknya.
 */
export function saringFakta(baris: readonly BarisSeasonal[], peta: Map<string, string>): HasilFakta {
  const fakta: FaktaPenjualan[] = [];
  const yatim = new Set<string>();
  let korporat = 0;
  let cacat = 0;

  for (const r of baris) {
    const branch = (r.branch ?? "").trim();
    if (branch === "") {
      korporat += 1;
      continue;
    }
    const outletId = peta.get(branch);
    if (!outletId) {
      yatim.add(branch);
      continue;
    }
    if (!POLA_TANGGAL.test(r.day ?? "")) {
      cacat += 1;
      continue;
    }
    const net = angka(r.net);
    if (net === null) {
      cacat += 1;
      continue;
    }
    fakta.push({
      outletId,
      branch,
      tanggal: r.day,
      net,
      gross: angka(r.gross),
      pax: bulat(r.pax),
      bills: bulat(r.bills),
    });
  }

  return {
    fakta,
    dibuang: {
      korporat,
      yatim: baris.length - fakta.length - korporat - cacat,
      cacat,
      cabangYatim: [...yatim].sort(),
    },
  };
}

/** Angka yang benar-benar angka. Null, kosong, dan NaN dikembalikan null —
 *  BUKAN nol. */
function angka(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bulat(v: unknown): number | null {
  const n = angka(v);
  return n === null ? null : Math.round(n);
}

/* ───────────────────────────── agregasi ───────────────────────────── */

export interface RingkasOutlet {
  outletId: string;
  net: number;
  gross: number | null;
  pax: number | null;
  bills: number | null;
  /** Berapa hari yang ADA barisnya. Bukan berapa hari dalam periodenya. */
  hariAda: number;
}

/**
 * Jumlahkan fakta per outlet.
 *
 * `gross`, `pax`, dan `bills` tetap null bila TIDAK SATU PUN barisnya punya
 * angka itu — bukan nol. Nol berarti "terukur dan hasilnya nol"; null berarti
 * "tidak pernah terukur", dan dua hal itu menuntut tindakan yang berbeda.
 */
export function jumlahPerOutlet(fakta: readonly FaktaPenjualan[]): RingkasOutlet[] {
  const peta = new Map<string, RingkasOutlet>();
  for (const f of fakta) {
    const r = peta.get(f.outletId) ?? { outletId: f.outletId, net: 0, gross: null, pax: null, bills: null, hariAda: 0 };
    r.net += f.net;
    if (f.gross !== null) r.gross = (r.gross ?? 0) + f.gross;
    if (f.pax !== null) r.pax = (r.pax ?? 0) + f.pax;
    if (f.bills !== null) r.bills = (r.bills ?? 0) + f.bills;
    r.hariAda += 1;
    peta.set(f.outletId, r);
  }
  return [...peta.values()].sort((a, b) => b.net - a.net);
}

/** Total seluruh outlet dalam cakupan. Aman dari hitung ganda karena barisnya
 *  sudah lewat `saringFakta`. */
export function totalNet(fakta: readonly FaktaPenjualan[]): number {
  return fakta.reduce((n, f) => n + f.net, 0);
}

/** Fakta per outlet per tanggal: "outletId|YYYY-MM-DD" → net. */
export function petaHarian(fakta: readonly FaktaPenjualan[]): Map<string, number> {
  const peta = new Map<string, number>();
  for (const f of fakta) peta.set(`${f.outletId}|${f.tanggal}`, f.net);
  return peta;
}
