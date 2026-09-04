import type { Indikator, JenisTarget } from "./indikator";

/**
 * Mesin hitung KPI — satu-satunya tempat angka capaian dihitung.
 *
 * Sepuluh posisi memakai fungsi yang sama. Kalau tiap posisi menghitung
 * sendiri, satu perubahan kebijakan berarti sepuluh tempat yang harus diubah
 * serempak, dan satu yang tertinggal berarti dua orang dinilai dengan aturan
 * yang berbeda tanpa ada yang tahu.
 *
 * TIGA ATURAN YANG MENENTUKAN SELURUH ISINYA:
 *
 * 1. **Persentase dibatasi 100%.** Bobot 10% dengan capaian 150% tetap
 *    bernilai 10%, bukan 15%. Tanpa batas ini, satu indikator yang mudah
 *    dilampaui bisa menutupi seluruh indikator lain yang gagal.
 *
 * 2. **Yang belum ada datanya bukan nol.** Indikator tanpa target atau tanpa
 *    actual dilaporkan sebagai belum terukur dan dikeluarkan dari bobot yang
 *    terpakai. Nol berarti "gagal total" — tuduhan yang berbeda dari "belum
 *    diukur", dan bulan pertama setiap indikator pertumbuhan selalu begitu.
 *
 * 3. **Pembulatan paling akhir.** Seluruh perhitungan memakai angka penuh;
 *    yang dibulatkan hanya yang ditampilkan. Membulatkan di tengah membuat
 *    hasilnya meleset dari hitungan manual di spreadsheet — dan angka yang
 *    tidak cocok dengan hitungan sendiri tidak akan dipercaya siapa pun.
 */

export interface BarisKpi {
  key: string;
  label: string;
  kategori?: string;
  bobot: number;
  /** Null berarti targetnya belum bisa ditentukan (mis. belum ada bulan lalu). */
  target: number | null;
  actual: number | null;
  /** 0–100, sudah dibatasi. Null bila belum ada datanya. */
  persentase: number | null;
  /** bobot × persentase. Null bila belum ada datanya. */
  persenActual: number | null;
  /** Kenapa belum ada datanya — ditulis apa adanya di layar. */
  alasan?: string;
  penjelasan: string;
  /** Satuan tampilan: angka biasa, rupiah, atau persen. */
  satuan?: "angka" | "rupiah" | "persen";
}

export const BATAS_PERSENTASE = 100;

/**
 * Capaian satu indikator. Target nol atau kosong = belum terukur.
 *
 * `mode` menentukan arah penilaiannya:
 *  • bawaan — makin besar makin baik (penjualan, jumlah audit);
 *  • `batas_maks` — targetnya BATAS ATAS yang masih boleh (komplain). Tanpa
 *    mode ini, 30 komplain dari batas 20 menghasilkan 150% lalu dipotong jadi
 *    100%, dan yang paling banyak dikomplain justru bernilai penuh;
 *  • `lulus_maks` — batas atas yang tidak boleh dilewati sama sekali (HPP).
 *    Tidak ada nilai separuh: 40,1% sama nilainya dengan 80%.
 */
export function persentaseCapaian(
  actual: number | null,
  target: number | null,
  mode?: "batas_maks" | "lulus_maks",
): number | null {
  if (actual === null || target === null) return null;
  // Target nol bukan capaian sempurna, melainkan target yang belum ditetapkan.
  // Membaginya menghasilkan tak-hingga, dan menganggapnya 100% memberi nilai
  // penuh untuk sesuatu yang tidak pernah diminta.
  if (target <= 0) return null;

  if (mode === "lulus_maks") return actual <= target ? BATAS_PERSENTASE : 0;
  if (mode === "batas_maks") {
    // Nol komplain bukan pembagian dengan nol — itu hasil terbaik yang mungkin.
    if (actual <= target) return BATAS_PERSENTASE;
    return (target / actual) * 100;
  }
  return Math.min(BATAS_PERSENTASE, (actual / target) * 100);
}

export function barisKpi(input: {
  indikator: Indikator;
  bobot: number;
  target: number | null;
  actual: number | null;
  alasan?: string;
  satuan?: BarisKpi["satuan"];
}): BarisKpi {
  const persentase = persentaseCapaian(input.actual, input.target, input.indikator.penilaian);
  return {
    key: input.indikator.key,
    label: input.indikator.label,
    kategori: input.indikator.kategori,
    bobot: input.bobot,
    target: input.target,
    actual: input.actual,
    persentase,
    persenActual: persentase === null ? null : (input.bobot * persentase) / 100,
    alasan: input.alasan,
    penjelasan: input.indikator.penjelasan,
    satuan: input.satuan ?? input.indikator.satuan,
  };
}

export interface RingkasKpi {
  /** Jumlah seluruh % actual — angka yang sama dengan hitungan di spreadsheet. */
  skor: number;
  /** Bobot indikator yang benar-benar terukur. */
  bobotTerpakai: number;
  /** Bobot seluruh indikator, terukur maupun belum. */
  bobotTotal: number;
  /**
   * Skor bila hanya menghitung indikator yang ada datanya, diskalakan ke 100.
   *
   * Dipakai membandingkan antar-posisi ketika sebagian indikator belum
   * terukur — tanpa ini, posisi yang satu indikatornya belum bisa dihitung
   * selalu tampak lebih buruk daripada yang lengkap.
   */
  skorSetara: number | null;
  jumlahTerukur: number;
  jumlahBelumTerukur: number;
}

export function ringkasKpi(baris: BarisKpi[]): RingkasKpi {
  const terukur = baris.filter((b) => b.persenActual !== null);
  const skor = terukur.reduce((a, b) => a + (b.persenActual ?? 0), 0);
  const bobotTerpakai = terukur.reduce((a, b) => a + b.bobot, 0);
  return {
    skor,
    bobotTerpakai,
    bobotTotal: baris.reduce((a, b) => a + b.bobot, 0),
    skorSetara: bobotTerpakai > 0 ? (skor / bobotTerpakai) * 100 : null,
    jumlahTerukur: terukur.length,
    jumlahBelumTerukur: baris.length - terukur.length,
  };
}

/* ─────────────────────────────── target ─────────────────────────────── */

export interface KonteksTarget {
  /** Jumlah brand aktif — pengali target "per brand". */
  jumlahBrand: number;
  /** Jumlah outlet aktif — target indikator berbasis outlet. */
  jumlahOutlet: number;
  /** Capaian bulan lalu, untuk target yang tumbuh. Null = belum ada. */
  actualBulanLalu: number | null;
  /** Jumlah pekerjaan yang masuk bulan itu (mis. permintaan desain). */
  jumlahPekerjaan: number | null;
  /** Rata-rata tiga bulan yang sudah selesai — dasar target `avg3`. */
  rataTigaBulan: number | null;
  /** Capaian indikator yang dirujuk target `porsi`. */
  dasarPorsi: number | null;
}

/**
 * Target satu indikator pada satu bulan.
 *
 * Mengembalikan null bila belum bisa ditentukan — paling sering pada indikator
 * pertumbuhan di bulan pertama, karena tidak ada bulan lalu untuk dijadikan
 * dasar. Itu bukan kesalahan dan bukan nol; itu memang belum ada.
 */
export function hitungTarget(t: JenisTarget, k: KonteksTarget): number | null {
  switch (t.jenis) {
    case "tetap":
      return t.perBrand ? t.nilai * Math.max(0, k.jumlahBrand) : t.nilai;
    case "tumbuh":
      return k.actualBulanLalu === null ? null : k.actualBulanLalu * (1 + t.pertumbuhan / 100);
    case "pekerjaan":
      return k.jumlahPekerjaan;
    case "outlet":
      return k.jumlahOutlet;
    case "rasio":
      return t.nilai;
    case "avg3":
      return k.rataTigaBulan === null ? null : k.rataTigaBulan * (1 + t.pertumbuhan / 100);
    case "porsi":
      return k.dasarPorsi === null ? null : k.dasarPorsi * (t.rasio / 100);
  }
}

/* ────────────────────────── indikator pengurang ────────────────────────── */

/**
 * Indikator yang dihitung mundur: target dikurangi jumlah kegagalan.
 *
 * Tidak pernah negatif. Sebelas temuan dari target sepuluh berarti nol, bukan
 * minus satu — nilai minus akan menarik turun skor indikator lain, dan
 * hukuman untuk satu indikator tidak boleh merembet ke indikator yang tidak
 * ada hubungannya.
 */
export const actualPengurang = (target: number | null, jumlahGagal: number): number | null =>
  target === null ? null : Math.max(0, target - jumlahGagal);

/**
 * Indikator lulus-atau-tidak: satu keterlambatan saja membuat nilainya nol.
 *
 * Dipakai Kelengkapan & Kualitas Data Analisa, sesuai permintaan: laporan yang
 * telat sehari sama saja dengan tidak dikirim, karena rapat yang menunggunya
 * sudah lewat.
 */
export const actualLulus = (target: number | null, jumlahTelat: number): number | null =>
  target === null ? null : jumlahTelat > 0 ? 0 : target;

/* ──────────────────────── efisiensi beban operasional ──────────────────────── */

/** Patokan bawaan: beban operasional dianggap wajar sampai 35% dari penjualan. */
export const PATOKAN_EFISIENSI = 35;
/** Bagian warehouse dari rata-rata penjualan. */
export const BAGIAN_WAREHOUSE = 30;
/** Bagian non-warehouse, dihitung dari budget warehouse. */
export const BAGIAN_NON_WAREHOUSE = 5;

export interface BarisEfisiensi {
  outletId: string;
  outletNama: string;
  /** Rata-rata net sales 3 bulan terakhir. Null = belum ada datanya. */
  average: number | null;
  /** Kenapa `average` kosong — dibedakan supaya yang membacanya tahu apa yang
   *  harus dikerjakan: memasang outlet ke ESB, atau menunggu penarikan data. */
  alasan?: string;
  targetWh: number | null;
  targetNonWh: number | null;
  actualWh: number | null;
  actualNonWh: number | null;
  budget: number | null;
  actual: number | null;
  /** (actual ÷ budget) × patokan — dibandingkan dengan patokan itu sendiri. */
  persenActual: number | null;
  /** Selisih terhadap patokan; negatif berarti tersisa, positif melebihi. */
  selisih: number | null;
}

export function barisEfisiensi(
  input: { outletId: string; outletNama: string; average: number | null; actualWh: number | null; actualNonWh: number | null },
  opsi: { bagianWh?: number; bagianNonWh?: number; patokan?: number } = {},
): BarisEfisiensi {
  const bagianWh = opsi.bagianWh ?? BAGIAN_WAREHOUSE;
  const bagianNonWh = opsi.bagianNonWh ?? BAGIAN_NON_WAREHOUSE;
  const patokan = opsi.patokan ?? PATOKAN_EFISIENSI;

  const targetWh = input.average === null ? null : input.average * (bagianWh / 100);
  const targetNonWh = targetWh === null ? null : targetWh * (bagianNonWh / 100);
  const budget = targetWh === null || targetNonWh === null ? null : targetWh + targetNonWh;

  // Satu kolom terisi sudah cukup dihitung; yang kosong dianggap nol HANYA
  // bila pasangannya terisi. Kalau dua-duanya kosong, outletnya memang belum
  // dilaporkan — dan menghitungnya nol berarti mengklaim outlet itu tidak
  // mengeluarkan biaya sama sekali.
  const adaActual = input.actualWh !== null || input.actualNonWh !== null;
  const actual = adaActual ? (input.actualWh ?? 0) + (input.actualNonWh ?? 0) : null;

  const persenActual = budget === null || budget <= 0 || actual === null ? null : (actual / budget) * patokan;
  return {
    outletId: input.outletId,
    outletNama: input.outletNama,
    average: input.average,
    targetWh,
    targetNonWh,
    actualWh: input.actualWh,
    actualNonWh: input.actualNonWh,
    budget,
    actual,
    persenActual,
    selisih: persenActual === null ? null : persenActual - patokan,
  };
}

/**
 * Seluruh outlet menjadi SATU capaian.
 *
 * Ditotalkan, bukan dirata-rata: rata-rata memperlakukan outlet beromset 20
 * juta setara dengan outlet beromset 250 juta, sehingga satu cabang kecil yang
 * boros bisa menutupi seluruh perusahaan yang hemat — atau sebaliknya.
 *
 * Capaiannya = budget ÷ realisasi. Belanja tepat sesuai budget berarti 100%;
 * lebih hemat tetap 100% karena batas capaian; lebih boros turun sebanding.
 */
export function ringkasEfisiensi(baris: BarisEfisiensi[], patokan = PATOKAN_EFISIENSI) {
  const dipakai = baris.filter((b) => b.budget !== null && b.actual !== null);
  const totalBudget = dipakai.reduce((a, b) => a + (b.budget ?? 0), 0);
  const totalActual = dipakai.reduce((a, b) => a + (b.actual ?? 0), 0);
  const persenActual = totalBudget > 0 ? (totalActual / totalBudget) * patokan : null;
  return {
    totalBudget,
    totalActual,
    persenActual,
    selisih: persenActual === null ? null : persenActual - patokan,
    /** 0–100 untuk dipakai indikator KPI. */
    capaian: totalActual > 0 && totalBudget > 0 ? Math.min(100, (totalBudget / totalActual) * 100) : null,
    outletTerhitung: dipakai.length,
    outletTanpaData: baris.length - dipakai.length,
  };
}

/* ─────────────────────────── keberhasilan pasar ─────────────────────────── */

export interface BarisMenuPasar {
  menu: string;
  penjualan: number;
  /** Bagian menu ini terhadap omset, dalam persen. */
  bagian: number;
}

/**
 * Keberhasilan pasar — penjualan menu baru dibanding omset.
 *
 * Keduanya diambil dari rentang yang sama (3 bulan terakhir). Membandingkan
 * penjualan 3 bulan dengan omset 1 bulan akan melipatgandakan hasilnya tiga
 * kali tanpa ada yang menyadarinya.
 */
export function keberhasilanPasar(menu: { menu: string; penjualan: number }[], omset: number, targetRasio: number) {
  const total = menu.reduce((a, m) => a + m.penjualan, 0);
  const bagianTotal = omset > 0 ? (total / omset) * 100 : null;
  return {
    baris: menu.map((m) => ({ ...m, bagian: omset > 0 ? (m.penjualan / omset) * 100 : 0 })) as BarisMenuPasar[],
    omset,
    total,
    bagianTotal,
    /** Capaian terhadap target rasio, 0–100. */
    capaian: bagianTotal === null || targetRasio <= 0 ? null : Math.min(100, (bagianTotal / targetRasio) * 100),
  };
}
