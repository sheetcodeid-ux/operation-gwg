/**
 * KPI Departemen Human Capital — Petunjuk Teknis (berlaku Januari 2026).
 *
 * Definisi indikator, bobot, satuan, target, cara pengukuran, kriteria dan bukti
 * pendukung diambil langsung dari juknis resmi. Modul ini client-safe (tanpa
 * server-only) supaya form, tabel dan chart memakai angka yang sama persis.
 */

export type KpiKey = "rekrutmen" | "waktu" | "kualitas" | "development" | "kinerja" | "administrasi";

export interface KpiIndicator {
  key: KpiKey;
  no: number;
  name: string;
  /** Label pendek untuk sumbu chart. */
  short: string;
  /** Bobot terhadap total penilaian (jumlah seluruhnya 100). */
  weight: number;
  unit: string;
  /** Target bawaan sesuai juknis; masih bisa disesuaikan per bulan. */
  defaultTarget: number;
  /** Waktu Rekrutmen: semakin CEPAT semakin baik → capaian dibalik. */
  lowerIsBetter?: boolean;
  measure: string;
  criteria: string;
  evidence: string;
}

export const KPI_INDICATORS: KpiIndicator[] = [
  {
    key: "rekrutmen",
    no: 1,
    name: "Jumlah Rekrutmen",
    short: "Rekrutmen",
    weight: 10,
    unit: "Orang",
    defaultTarget: 0,
    measure: "Menghitung total pegawai yang di-request dan yang berhasil direkrut dalam 1 bulan.",
    criteria: "Tercapai jika jumlah request sama dengan jumlah rekrutan.",
    evidence: "Formulir permintaan pegawai, offering letter, SK Pengangkatan, database.",
  },
  {
    key: "waktu",
    no: 2,
    name: "Waktu Rekrutmen",
    short: "Waktu",
    weight: 10,
    unit: "Hari",
    defaultTarget: 21,
    lowerIsBetter: true,
    measure: "Rata-rata hari dari Job Posting (medsos / job portal) hingga kandidat diterima / onboarding.",
    criteria: "Tercapai jika rata-rata waktu rekrutmen ≤ target (semakin cepat semakin baik).",
    evidence: "Tanggal job posting, tanggal offer diterima, log rekrutmen.",
  },
  {
    key: "kualitas",
    no: 3,
    name: "Keberhasilan / Kualitas Rekrutmen",
    short: "Kualitas",
    weight: 20,
    unit: "Orang",
    defaultTarget: 10,
    measure: "Jumlah pegawai baru yang lulus masa percobaan dengan nilai minimal BAIK, atau resign sesuai prosedur.",
    criteria: "Tercapai jika jumlah pegawai lolos probation = target.",
    evidence: "Hasil evaluasi masa percobaan, form penilaian kinerja probation.",
  },
  {
    key: "development",
    no: 4,
    name: "Development / Pelatihan",
    short: "Pelatihan",
    weight: 20,
    unit: "Program",
    defaultTarget: 4,
    measure: "Jumlah program pelatihan / pengembangan SDM yang terlaksana dalam 1 bulan.",
    criteria: "Tercapai jika pelatihan dilaksanakan minimal 4× per bulan.",
    evidence: "Laporan pelaksanaan, daftar hadir, materi pelatihan, foto kegiatan.",
  },
  {
    key: "kinerja",
    no: 5,
    name: "Manajemen Kinerja",
    short: "Kinerja",
    weight: 20,
    unit: "%",
    defaultTarget: 20,
    measure: "Persentase karyawan yang telah mendapat penilaian kinerja sesuai jadwal: (karyawan dinilai / total karyawan) × bobot.",
    criteria: "Tercapai jika seluruh karyawan dinilai sesuai jadwal.",
    evidence: "Form penilaian kinerja bertanda tangan, dashboard rekapitulasi penilaian.",
  },
  {
    key: "administrasi",
    no: 6,
    name: "Administrasi Personalia",
    short: "Administrasi",
    weight: 20,
    unit: "Dokumen",
    defaultTarget: 20,
    measure: "Jumlah dokumen administrasi kepegawaian yang selesai tepat waktu dan sesuai standar.",
    criteria: "Tercapai jika jumlah dokumen terselesaikan = target (20 dokumen).",
    evidence: "Dokumen kontrak kerja, SK, surat keterangan, dan administrasi lain yang diproses.",
  },
];

export const KPI_BY_KEY: Record<KpiKey, KpiIndicator> = Object.fromEntries(
  KPI_INDICATORS.map((i) => [i.key, i]),
) as Record<KpiKey, KpiIndicator>;

/** Bukti pendukung yang dilampirkan pada satu indikator. */
export interface KpiAttachment {
  path?: string;
  name: string;
  url?: string;
}

/** Isian satu indikator untuk satu periode (bulan). */
export interface KpiEntry {
  key: KpiKey;
  target: number;
  realisasi: number;
  note: string;
  attachments: KpiAttachment[];
  updatedByName?: string | null;
  updatedAt?: string | null;
}

export interface KpiRow extends KpiEntry {
  indicator: KpiIndicator;
  /** Realisasi − Target (untuk Waktu Rekrutmen, negatif = lebih cepat = baik). */
  selisih: number;
  /** (Realisasi / Target) × 100, dibalik untuk indikator "semakin kecil semakin baik". */
  capaian: number;
  /** Bobot × Capaian — kontribusi indikator ke total skor. */
  aktual: number;
  /** Sudah diisi (realisasi atau target disentuh). */
  filled: boolean;
}

/** Persentase capaian satu indikator, menghormati arah "semakin kecil semakin baik". */
export function capaianOf(ind: KpiIndicator, target: number, realisasi: number): number {
  if (!target || !realisasi) return 0;
  const raw = ind.lowerIsBetter ? (target / realisasi) * 100 : (realisasi / target) * 100;
  return Math.round(raw * 100) / 100;
}

/** Kontribusi ke total skor = bobot × capaian. Dibatasi pada bobot penuh agar
 *  total tetap maksimal 100% walau satu indikator melampaui target. */
export function aktualOf(ind: KpiIndicator, capaian: number): number {
  const val = (ind.weight * Math.min(capaian, 100)) / 100;
  return Math.round(val * 100) / 100;
}

export function buildRows(entries: Partial<Record<KpiKey, KpiEntry>>): KpiRow[] {
  return KPI_INDICATORS.map((indicator) => {
    const e = entries[indicator.key];
    const target = e?.target ?? indicator.defaultTarget;
    const realisasi = e?.realisasi ?? 0;
    const capaian = capaianOf(indicator, target, realisasi);
    return {
      key: indicator.key,
      indicator,
      target,
      realisasi,
      note: e?.note ?? "",
      attachments: e?.attachments ?? [],
      updatedByName: e?.updatedByName ?? null,
      updatedAt: e?.updatedAt ?? null,
      selisih: Math.round((realisasi - target) * 100) / 100,
      capaian,
      aktual: aktualOf(indicator, capaian),
      filled: !!e && (e.realisasi > 0 || !!e.note || e.attachments.length > 0),
    };
  });
}

export function totalScore(rows: KpiRow[]): number {
  return Math.round(rows.reduce((sum, r) => sum + r.aktual, 0) * 100) / 100;
}

export type KpiCategoryTone = "success" | "brand" | "warning" | "danger";

export interface KpiCategory {
  label: string;
  tone: KpiCategoryTone;
  action: string;
}

/** Interpretasi hasil sesuai juknis §VIII. */
export function kpiCategory(score: number): KpiCategory {
  if (score >= 95) return { label: "SANGAT BAIK", tone: "success", action: "Pertahankan dan jadikan benchmark." };
  if (score >= 80) return { label: "BAIK", tone: "brand", action: "Identifikasi area yang perlu ditingkatkan." };
  if (score >= 65) return { label: "CUKUP", tone: "warning", action: "Susun rencana perbaikan dengan timeline yang jelas." };
  return { label: "PERLU PERBAIKAN", tone: "danger", action: "Evaluasi mendalam dan eskalasi ke manajemen." };
}

export const KPI_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** Periode disimpan sebagai "YYYY-MM". */
export const kpiPeriod = (year: number, monthIndex: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
export function kpiPeriodLabel(period: string): string {
  const [y, m] = period.split("-");
  return `${KPI_MONTHS[Number(m) - 1] ?? m} ${y}`;
}
