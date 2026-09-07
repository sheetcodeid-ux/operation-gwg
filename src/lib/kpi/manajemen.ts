/**
 * Kalkulator KPI Manajemen — mesin hitungnya saja, tanpa basis data.
 *
 * Empat komponen berbobot yang dijumlahkan jadi satu skor 0–100:
 *
 *   A. Gross Sales Corporate        40%
 *   B. Same Store Sales             30%
 *   C. EBITDA / Laba Bersih SS      20%
 *   D. KPI All Division             10%
 *
 * SATU ATURAN YANG BERLAKU UNTUK A, B, DAN C: pencapaian di atas 100% TIDAK
 * menambah skor melebihi bobotnya. Tanpa batas itu, satu komponen yang mudah
 * dilampaui bisa menutupi tiga komponen lain yang gagal — dan skor akhirnya
 * tetap terlihat sehat.
 *
 * BEDANYA DENGAN KPI POSISI (`hitung.ts`): di sana yang dinilai satu orang pada
 * satu posisi, di sini yang dinilai PERUSAHAAN pada satu bulan. Rumusnya tidak
 * dipakai bersama dengan sengaja — menyatukannya berarti satu perubahan
 * kebijakan di salah satu tempat diam-diam mengubah yang lain.
 */

export const BOBOT = { a: 40, b: 30, c: 20, d: 10 } as const;

/** Target margin EBITDA terhadap sales same store. */
export const TARGET_MARGIN = 30;

/** Umur minimum outlet (bulan) supaya ikut Same Store Sales. */
export const UMUR_SAME_STORE = 3;

/**
 * Pencapaian dibatasi 1 (100%).
 *
 * Ditulis sebagai fungsi tersendiri, bukan ditempel di tiap rumus, supaya
 * batasnya tidak bisa lupa dipasang pada komponen yang ditambahkan kemudian.
 */
export const batas1 = (rasio: number): number => (Number.isFinite(rasio) ? Math.max(0, Math.min(1, rasio)) : 0);

/**
 * Rasio yang aman terhadap pembagi nol.
 *
 * Target nol berarti belum ada dasarnya, bukan pencapaian tak terhingga —
 * dan tak terhingga yang lolos ke layar akan tampil sebagai skor penuh.
 */
export const rasio = (atas: number, bawah: number): number => (bawah > 0 ? atas / bawah : 0);

/* ───────────────────────── A. Gross Sales Corporate ───────────────────────── */

export interface KomponenA {
  /** Omzet tiga bulan sebelumnya, urut dari yang paling lama. */
  bulanLalu: [number, number, number];
  actual: number;
}

export interface HasilKomponen {
  target: number;
  actual: number;
  /** 0–1, belum dibatasi — dipakai untuk menampilkan pencapaian sebenarnya. */
  capaian: number;
  /** 0–bobot. */
  skor: number;
}

export function hitungA(a: KomponenA): HasilKomponen {
  const target = (a.bulanLalu[0] + a.bulanLalu[1] + a.bulanLalu[2]) / 3;
  const capaian = rasio(a.actual, target);
  return { target, actual: a.actual, capaian, skor: batas1(capaian) * BOBOT.a };
}

/* ─────────────────────────── B. Same Store Sales ─────────────────────────── */

export interface OutletManajemen {
  id: string;
  nama: string;
  /** Umur operasional dalam bulan. Null = belum diketahui. */
  umur: number | null;
  /** Sales tiga bulan sebelumnya, urut dari yang paling lama. */
  bulanLalu: [number, number, number];
  actual: number;
}

export interface BarisOutletB extends OutletManajemen {
  target: number;
  /** Ikut dihitung? Outlet berumur ≤ 3 bulan dikecualikan. */
  ikut: boolean;
}

export interface HasilB extends HasilKomponen {
  baris: BarisOutletB[];
  jumlahIkut: number;
  jumlahBaru: number;
}

/**
 * Outlet baru DIKECUALIKAN, bukan dinilai nol.
 *
 * Outlet yang baru buka selalu menyeret pertumbuhan same-store ke bawah karena
 * ia tidak punya pembanding — memasukkannya berarti menghukum manajemen atas
 * keputusan membuka outlet baru.
 *
 * Umur yang belum diketahui TIDAK dianggap outlet baru. Tanggal buka adalah
 * catatan administratif yang banyak kosong, dan mengecualikan outlet karena
 * catatannya belum diisi membuat seluruh tabel berstatus dikecualikan padahal
 * outletnya sudah bertahun-tahun jalan. Penggantinya bukti dari penjualannya
 * sendiri: outlet yang punya omzet di KETIGA bulan pembanding sudah pasti
 * berjalan lebih dari tiga bulan. Aturan yang sama dipakai Coordinator Area.
 */
export function hitungB(outlet: OutletManajemen[]): HasilB {
  const baris: BarisOutletB[] = outlet.map((o) => ({
    ...o,
    target: (o.bulanLalu[0] + o.bulanLalu[1] + o.bulanLalu[2]) / 3,
    ikut: o.umur === null ? o.bulanLalu.every((n) => n > 0) : o.umur > UMUR_SAME_STORE,
  }));
  const ikut = baris.filter((b) => b.ikut);
  const target = ikut.reduce((s, b) => s + b.target, 0);
  const actual = ikut.reduce((s, b) => s + b.actual, 0);
  const capaian = rasio(actual, target);
  return {
    baris,
    jumlahIkut: ikut.length,
    jumlahBaru: baris.length - ikut.length,
    target,
    actual,
    capaian,
    skor: batas1(capaian) * BOBOT.b,
  };
}

/* ──────────────────────── C. EBITDA / Laba Bersih SS ──────────────────────── */

export interface HasilC {
  labaBersih: number;
  sales: number;
  /** Margin dalam persen, belum dibatasi. */
  margin: number;
  capaian: number;
  skor: number;
}

/**
 * Skor proporsional terhadap target margin, bukan lulus-atau-tidak.
 *
 * Margin 15% dari target 30% bernilai separuh bobotnya. Dibuat berjenjang
 * karena margin adalah hasil dari puluhan keputusan kecil sepanjang bulan;
 * menilainya nol-atau-penuh membuat selisih 0,1% berarti sama besar dengan
 * selisih 15%.
 */
export function hitungC(labaBersih: number, sales: number): HasilC {
  const margin = rasio(labaBersih, sales) * 100;
  const capaian = rasio(margin, TARGET_MARGIN);
  return { labaBersih, sales, margin, capaian, skor: batas1(capaian) * BOBOT.c };
}

/* ─────────────────────────── D. KPI All Division ─────────────────────────── */

export interface DivisiKpi {
  nama: string;
  /** 0–100. */
  nilai: number;
}

export interface HasilD {
  divisi: DivisiKpi[];
  rata: number;
  skor: number;
}

/**
 * Seluruh divisi berbobot SAMA RATA.
 *
 * Bukan karena semuanya sama pentingnya, melainkan karena tidak ada dasar yang
 * bisa dipertahankan untuk membedakannya — dan bobot yang dibuat-buat lebih
 * buruk daripada bobot yang rata.
 */
export function hitungD(divisi: DivisiKpi[]): HasilD {
  const rata = divisi.length === 0 ? 0 : divisi.reduce((s, d) => s + d.nilai, 0) / divisi.length;
  return { divisi, rata, skor: (Math.max(0, Math.min(100, rata)) / 100) * BOBOT.d };
}

/* ───────────────────────────── skor akhir ───────────────────────────── */

export type Peringkat = "sangat_baik" | "baik" | "perhatian" | "kritis";

export interface LabelPeringkat {
  id: Peringkat;
  label: string;
  /** Nama nada warna yang dipakai lencana dan cincin. */
  tone: "success" | "warning" | "amber" | "danger";
}

/**
 * Ambang penilaian.
 *
 * "Perlu Perhatian" dan "Kritis" SENGAJA berbeda warnanya. Pada versi
 * sebelumnya keduanya merah, jadi skor 69 dan skor 20 terlihat sama gawatnya —
 * dan yang membacanya kehilangan satu-satunya petunjuk bahwa yang satu masih
 * bisa dikejar sementara yang lain tidak.
 */
export function peringkat(skor: number): LabelPeringkat {
  if (skor >= 85) return { id: "sangat_baik", label: "Sangat Baik", tone: "success" };
  if (skor >= 70) return { id: "baik", label: "Baik", tone: "amber" };
  if (skor >= 50) return { id: "perhatian", label: "Perlu Perhatian", tone: "warning" };
  return { id: "kritis", label: "Kritis", tone: "danger" };
}

export interface SkorManajemen {
  a: HasilKomponen;
  b: HasilB;
  c: HasilC;
  d: HasilD;
  akhir: number;
  peringkat: LabelPeringkat;
}

/**
 * Skor akhir = A + B + C + D.
 *
 * DIBULATKAN DUA DESIMAL DI UJUNG, bukan di tiap komponen. Membulatkan lebih
 * awal membuat jumlah keempat kartu tidak sama dengan angka di gauge — dan
 * angka yang tidak cocok dengan penjumlahannya sendiri tidak akan dipercaya
 * siapa pun.
 */
export function hitungManajemen(input: {
  a: KomponenA;
  outlet: OutletManajemen[];
  labaBersih: number;
  /** Kosong = pakai total actual same store dari komponen B. */
  salesManual: number | null;
  divisi: DivisiKpi[];
}): SkorManajemen {
  const a = hitungA(input.a);
  const b = hitungB(input.outlet);
  const c = hitungC(input.labaBersih, input.salesManual ?? b.actual);
  const d = hitungD(input.divisi);
  const akhir = Math.round((a.skor + b.skor + c.skor + d.skor) * 100) / 100;
  return { a, b, c, d, akhir, peringkat: peringkat(akhir) };
}
