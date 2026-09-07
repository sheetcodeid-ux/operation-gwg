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

/**
 * Bobot dan target adalah KEBIJAKAN, bukan tetapan program.
 *
 * Angkanya tetap ditulis di sini sebagai NILAI BAWAAN — halaman harus tetap
 * bisa dihitung saat penyimpanannya belum terisi — tapi yang dipakai
 * perhitungan adalah setelan yang datang dari basis data. Menanam kebijakan di
 * dalam kode berarti tiap penyesuaian menunggu deploy, dan sampai deploy itu
 * terjadi angkanya tidak bisa disesuaikan sama sekali.
 */
export interface SetelanManajemen {
  bobot: { a: number; b: number; c: number; d: number };
  /** Pertumbuhan yang dituntut dari penjualan, dalam persen. */
  pertumbuhan: number;
  /** Target margin EBITDA terhadap sales same store. */
  targetMargin: number;
  /** Persen dari target margin yang sudah dihitung tercapai. */
  ambangEbitda: number;
  /** Umur minimum outlet (bulan) supaya ikut Same Store Sales. */
  umurSameStore: number;
}

export const BOBOT = { a: 40, b: 30, c: 20, d: 10 } as const;

/** Target margin EBITDA terhadap sales same store. */
export const TARGET_MARGIN = 30;

/** Persen dari target margin yang sudah dianggap tercapai. */
export const AMBANG_EBITDA = 85;

/** Umur minimum outlet (bulan) supaya ikut Same Store Sales. */
export const UMUR_SAME_STORE = 3;

/**
 * Pertumbuhan yang dituntut dari penjualan, dalam persen.
 *
 * Rata-rata tiga bulan adalah keadaan SEKARANG, bukan sasaran — memakainya
 * apa adanya berarti perusahaan dinilai penuh hanya karena tidak menurun.
 *
 * SATU angka untuk Gross Sales Corporate dan Same Store Sales sekaligus, dan
 * sama pula dengan Gross Sales Coordinator Area. Dua laju berbeda untuk
 * penjualan yang sama akan tampil sebagai dua target berbeda di dua halaman,
 * dan yang membacanya akan mengira salah satunya salah hitung.
 */
export const PERTUMBUHAN = 15;

export const SETELAN_BAWAAN: SetelanManajemen = {
  bobot: { ...BOBOT },
  pertumbuhan: PERTUMBUHAN,
  targetMargin: TARGET_MARGIN,
  ambangEbitda: AMBANG_EBITDA,
  umurSameStore: UMUR_SAME_STORE,
};

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

export function hitungA(a: KomponenA, st: SetelanManajemen = SETELAN_BAWAAN): HasilKomponen {
  const rata = (a.bulanLalu[0] + a.bulanLalu[1] + a.bulanLalu[2]) / 3;
  const target = rata * (1 + st.pertumbuhan / 100);
  const capaian = rasio(a.actual, target);
  return { target, actual: a.actual, capaian, skor: batas1(capaian) * st.bobot.a };
}

/* ─────────────────────────── B. Same Store Sales ─────────────────────────── */

export interface OutletManajemen {
  id: string;
  nama: string;
  /** Kode pendek outlet — dipakai grafik, yang tidak muat nama panjang. */
  kode: string;
  /** Umur operasional dalam bulan. Null = belum diketahui. */
  umur: number | null;
  /** Sales tiga bulan sebelumnya, urut dari yang paling lama. */
  bulanLalu: [number, number, number];
  actual: number;
}

export interface BarisOutletB extends OutletManajemen {
  /** Rata-rata tiga bulan outlet itu sendiri + pertumbuhan. */
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
export function hitungB(outlet: OutletManajemen[], st: SetelanManajemen = SETELAN_BAWAAN): HasilB {
  const baris: BarisOutletB[] = outlet.map((o) => ({
    ...o,
    target: ((o.bulanLalu[0] + o.bulanLalu[1] + o.bulanLalu[2]) / 3) * (1 + st.pertumbuhan / 100),
    ikut: o.umur === null ? o.bulanLalu.every((n) => n > 0) : o.umur > st.umurSameStore,
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
    skor: batas1(capaian) * st.bobot.b,
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
export function hitungC(labaBersih: number, sales: number, st: SetelanManajemen = SETELAN_BAWAAN): HasilC {
  const margin = rasio(labaBersih, sales) * 100;
  const capaian = rasio(margin, st.targetMargin);
  return { labaBersih, sales, margin, capaian, skor: batas1(capaian) * st.bobot.c };
}

/* ─────────────────────────── D. KPI All Division ─────────────────────────── */

/** Satu posisi yang KPI-nya sudah punya modul, beserta capaian bulan lalunya. */
export interface PosisiKpi {
  kode: string;
  nama: string;
  /** 0–100. Null = modulnya belum menghasilkan angka bulan itu. */
  nilai: number | null;
  lalu: number | null;
}

export interface DepartemenKpi {
  kode: string;
  nama: string;
  /** Nama pendek untuk sumbu grafik. */
  singkat: string;
  posisi: PosisiKpi[];
  /** Rata-rata posisi yang ADA nilainya. Null bila belum satu pun terisi. */
  rata: number | null;
  lalu: number | null;
}

export interface HasilD {
  departemen: DepartemenKpi[];
  rata: number;
  skor: number;
}

/** Rata-rata yang mengabaikan yang belum terisi; kosong berarti null. */
const rataAda = (nilai: (number | null)[]): number | null => {
  const ada = nilai.filter((n): n is number => n !== null);
  return ada.length === 0 ? null : ada.reduce((s, n) => s + n, 0) / ada.length;
};

/**
 * Dua tingkat: posisi dirata-ratakan di dalam departemennya, baru
 * antar-departemen.
 *
 * Merata-ratakan seluruh posisi sekaligus membuat departemen yang posisinya
 * banyak berbobot lebih besar tanpa ada yang memutuskannya begitu: Finance
 * dengan tiga posisi akan bersuara tiga kali, Marketing Communication dengan
 * satu posisi sekali. Bertingkat membuat tiap departemen bersuara sekali,
 * berapa pun jumlah posisinya — dan menambah posisi baru tidak diam-diam
 * menggeser bobot departemen lain.
 *
 * Posisi yang belum menghasilkan angka DILEWATI, bukan dihitung nol. Nol
 * berarti "dinilai dan gagal"; yang sebenarnya terjadi adalah "belum diukur",
 * dan menyamakan keduanya menghukum departemen yang modulnya baru dipasang.
 */
export function hitungD(departemen: DepartemenKpi[], st: SetelanManajemen = SETELAN_BAWAAN): HasilD {
  const rata = rataAda(departemen.map((d) => d.rata)) ?? 0;
  return { departemen, rata, skor: (Math.max(0, Math.min(100, rata)) / 100) * st.bobot.d };
}

/** Membentuk satu departemen dari posisi-posisinya. */
export function departemenKpi(kode: string, nama: string, singkat: string, posisi: PosisiKpi[]): DepartemenKpi {
  return {
    kode,
    nama,
    singkat,
    posisi,
    rata: rataAda(posisi.map((p) => p.nilai)),
    lalu: rataAda(posisi.map((p) => p.lalu)),
  };
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
  departemen: DepartemenKpi[];
  setelan?: SetelanManajemen;
}): SkorManajemen {
  const st = input.setelan ?? SETELAN_BAWAAN;
  const a = hitungA(input.a, st);
  const b = hitungB(input.outlet, st);
  const c = hitungC(input.labaBersih, b.actual, st);
  const d = hitungD(input.departemen, st);
  const akhir = Math.round((a.skor + b.skor + c.skor + d.skor) * 100) / 100;
  return { a, b, c, d, akhir, peringkat: peringkat(akhir) };
}
