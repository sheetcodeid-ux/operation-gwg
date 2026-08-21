/**
 * KPI Human Capital — rancangan baru.
 *
 * Modul KPI yang lama dibongkar habis karena angkanya diketik manual: target
 * dan realisasi sama-sama diisi tangan, jadi capaiannya tidak pernah bisa
 * dibantah maupun dibuktikan. Yang di sini berbeda — SETIAP indikator dihitung
 * dari data yang sudah dimasukkan orang lain untuk keperluan lain:
 *
 *   • Permintaan & pemenuhan pegawai — dari Pengajuan (Permintaan Karyawan).
 *   • Kontrak & Update Bulanan — dari Kontrak Tracker.
 *   • Onboarding — dari ceklis orientasi.
 *   • Turnover — dari tanggal keluar karyawan.
 *   • Kelulusan Fast Start — dari nilai Post Test.
 *
 * Tidak ada satu pun angka yang bisa "dirapikan" tanpa mengubah data aslinya,
 * dan itulah gunanya. Yang tidak punya data dilaporkan sebagai belum ada
 * datanya, bukan diisi nol — nol berarti "gagal total", dan itu tuduhan yang
 * berbeda dari "belum diukur".
 */

export type KpiKey =
  | "pemenuhan_rekrutmen"
  | "kecepatan_rekrutmen"
  | "kepatuhan_kontrak"
  | "kepatuhan_laporan"
  | "penyelesaian_onboarding"
  | "turnover";

export interface KpiIndikator {
  key: KpiKey;
  label: string;
  satuan: "persen" | "hari";
  /** Target yang dianggap baik. */
  target: number;
  /** Untuk turnover, makin KECIL makin baik. */
  makinKecilMakinBaik?: boolean;
  /**
   * Bobot indikator ini terhadap skor total, dalam persen. Seluruhnya 100.
   *
   * Angka-angka ini KEBIJAKAN, bukan hasil hitungan — Human Capital yang
   * menentukan seberapa penting tiap indikator, dan wajar kalau kelak diubah.
   * Dicantumkan justru supaya bisa diperdebatkan: rata-rata biasa yang dipakai
   * sebelumnya juga sebuah pembobotan — semuanya dianggap sama penting — hanya
   * saja tidak pernah ada yang memutuskannya, dan tidak terlihat sehingga tidak
   * pernah bisa dikoreksi.
   */
  bobot: number;
  sumber: string;
  tindakLanjut: string;
}

export const KPI_HC: KpiIndikator[] = [
  {
    key: "pemenuhan_rekrutmen",
    bobot: 15,
    label: "Pemenuhan Permintaan Pegawai",
    satuan: "persen",
    target: 90,
    sumber: "Permintaan Karyawan — jumlah direkrut dibanding jumlah diminta.",
    tindakLanjut: "Tinjau permintaan yang menggantung dan tambah sumber kandidat.",
  },
  {
    key: "kecepatan_rekrutmen",
    bobot: 10,
    label: "Kecepatan Pemenuhan",
    satuan: "hari",
    target: 30,
    makinKecilMakinBaik: true,
    sumber: "Permintaan Karyawan — rata-rata hari dari diajukan sampai terlaksana.",
    tindakLanjut: "Percepat tahap yang paling lama: screening atau penjadwalan wawancara.",
  },
  {
    key: "kepatuhan_kontrak",
    bobot: 25,
    label: "Kepatuhan Kontrak Kerja",
    satuan: "persen",
    target: 95,
    sumber: "Kontrak Tracker — karyawan outlet dengan kontrak masih berlaku.",
    tindakLanjut: "Perpanjang kontrak yang lewat dan lengkapi karyawan yang belum berkontrak.",
  },
  {
    key: "kepatuhan_laporan",
    bobot: 15,
    label: "Kepatuhan Update Bulanan",
    satuan: "persen",
    target: 90,
    sumber: "Kontrak Tracker — outlet yang mengirim laporan bulan berjalan.",
    tindakLanjut: "Ingatkan supervisor outlet yang belum melapor bulan ini.",
  },
  {
    key: "penyelesaian_onboarding",
    bobot: 15,
    label: "Penyelesaian Onboarding",
    satuan: "persen",
    target: 85,
    sumber: "Onboarding — rata-rata butir ceklis yang sudah tuntas.",
    tindakLanjut: "Kejar butir yang paling sering tertinggal, biasanya BPJS dan perangkat.",
  },
  {
    key: "turnover",
    bobot: 20,
    label: "Turnover Karyawan Outlet",
    satuan: "persen",
    target: 10,
    makinKecilMakinBaik: true,
    sumber: "Kontrak Tracker — karyawan keluar dibanding jumlah karyawan.",
    tindakLanjut: "Telusuri alasan keluar terbanyak dan outlet yang paling sering berganti orang.",
  },
];

export const KPI_BY_KEY = Object.fromEntries(KPI_HC.map((k) => [k.key, k])) as Record<KpiKey, KpiIndikator>;

/**
 * Capaian terhadap target, 0–100.
 *
 * Untuk indikator yang makin kecil makin baik, capaian dihitung terbalik:
 * turnover 5% terhadap target 10% berarti capaian 100, bukan 50.
 */
export function capaian(ind: KpiIndikator, realisasi: number | null): number | null {
  if (realisasi === null) return null;
  if (ind.target <= 0) return null;
  const rasio = ind.makinKecilMakinBaik ? ind.target / Math.max(realisasi, 0.0001) : realisasi / ind.target;
  return Math.round(Math.min(rasio, 1.5) * 100);
}

export type NadaKpi = "success" | "brand" | "warning" | "danger";

export function nadaCapaian(nilai: number | null): NadaKpi {
  if (nilai === null) return "brand";
  if (nilai >= 100) return "success";
  if (nilai >= 85) return "brand";
  if (nilai >= 70) return "warning";
  return "danger";
}

export interface BarisKpi {
  key: KpiKey;
  realisasi: number | null;
  /** Penjelasan angkanya, mis. "18 dari 20 permintaan". */
  rincian: string;
}

export interface SkorKpi {
  /** 0–100, atau null bila belum ada satu pun indikator yang terukur. */
  nilai: number | null;
  /** Bobot indikator yang benar-benar terukur — penyebut yang dipakai. */
  bobotTerukur: number;
  terukur: number;
  belumTerukur: number;
}

/**
 * Skor KPI total, ditimbang menurut bobot tiap indikator.
 *
 * Indikator yang BELUM TERUKUR dikeluarkan dari pembilang MAUPUN penyebut —
 * bukan dihitung nol. Nol berarti "gagal total", dan itu tuduhan yang berbeda
 * dari "belum diukur"; menghitungnya nol membuat tim terlihat buruk justru pada
 * bulan-bulan awal sebuah modul dipakai, ketika datanya memang belum lengkap.
 */
export function skorKpi(baris: { key: KpiKey; realisasi: number | null }[]): SkorKpi {
  let jumlah = 0;
  let bobotTerukur = 0;
  let terukur = 0;
  for (const b of baris) {
    const ind = KPI_BY_KEY[b.key];
    if (!ind) continue;
    const c = capaian(ind, b.realisasi);
    if (c === null) continue;
    jumlah += c * ind.bobot;
    bobotTerukur += ind.bobot;
    terukur += 1;
  }
  return {
    nilai: bobotTerukur ? Math.round(jumlah / bobotTerukur) : null,
    bobotTerukur,
    terukur,
    belumTerukur: baris.length - terukur,
  };
}

export const STATUS_SKOR = [
  { batas: 100, label: "Baik", tone: "success" as const },
  { batas: 85, label: "Cukup", tone: "brand" as const },
  { batas: 70, label: "Perlu Perhatian", tone: "warning" as const },
  { batas: 0, label: "Kurang", tone: "danger" as const },
];

/** Sebutan untuk skor total — ambangnya sama dengan `nadaCapaian`. */
export function statusSkor(nilai: number | null): { label: string; tone: NadaKpi } {
  if (nilai === null) return { label: "Belum Terukur", tone: "brand" };
  return STATUS_SKOR.find((x) => nilai >= x.batas) ?? STATUS_SKOR[STATUS_SKOR.length - 1];
}
