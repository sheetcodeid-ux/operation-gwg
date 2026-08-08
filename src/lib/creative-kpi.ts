/**
 * KPI Creative — Social Media.
 *
 * Delapan indikator berbobot, dari DUA sumber:
 *
 *   Pengajuan Design (otomatis, 40%)
 *     1. Jumlah Konten Post   10%  target tetap 20
 *     2. Jumlah Konten Reels  10%  target tetap 20
 *     3. Jumlah Konten Story   5%  target tetap 20
 *     8. Kecepatan & Ketepatan 15% target tetap 100% (selesai ≤ deadline)
 *
 *   Instagram (diisi tangan dulu, API menyusul, 50%)
 *     4. Like+Komentar+Share+Save 15%
 *     5. Follower Growth          15%
 *     6. Views                    10%
 *     7. Profile Visit            10%
 *
 * Empat indikator Instagram memakai target BERGERAK: capaian bulan lalu + 10%.
 * Artinya bulan pertama belum punya baseline — lihat catatan "scored" di bawah.
 */

export type CreativeKpiKey =
  | "konten_post"
  | "konten_reels"
  | "konten_story"
  | "engagement"
  | "follower_growth"
  | "views"
  | "profile_visit"
  | "kecepatan";

/** Dari mana angka realisasinya datang. */
export type CreativeKpiSource = "design" | "instagram";

export interface CreativeKpiIndicator {
  key: CreativeKpiKey;
  no: number;
  name: string;
  short: string;
  unit: string;
  source: CreativeKpiSource;
  /**
   * Target tetap (Post/Reels/Story = 20, Kecepatan = 100%).
   * Kalau null, targetnya diturunkan dari bulan sebelumnya + 10%.
   */
  fixedTarget: number | null;
  /**
   * Jenis materi di Pengajuan Design yang dihitung — hanya untuk indikator
   * sumber "design". Harus SAMA PERSIS dengan `DESIGN_TYPES` di hc-request.ts;
   * salah satu huruf saja membuat hitungannya diam-diam nol.
   */
  designType?: string;
  measure: string;
}

/** Kenaikan target tiap bulan untuk indikator Instagram. */
export const GROWTH_RATE = 0.1;

/** Target tetap jumlah konten per bulan, per jenis. */
export const CONTENT_TARGET = 20;

export const CREATIVE_KPI_INDICATORS: CreativeKpiIndicator[] = [
  {
    key: "konten_post",
    no: 1,
    name: "Jumlah Konten Post",
    short: "Post",
    unit: "Konten",
    source: "design",
    fixedTarget: CONTENT_TARGET,
    designType: "Instagram Post",
    measure: 'Pengajuan Design jenis "Instagram Post" yang berstatus terlaksana pada bulan berjalan.',
  },
  {
    key: "konten_reels",
    no: 2,
    name: "Jumlah Konten Reels",
    short: "Reels",
    unit: "Konten",
    source: "design",
    fixedTarget: CONTENT_TARGET,
    designType: "Instagram Reels",
    measure: 'Pengajuan Design jenis "Instagram Reels" yang berstatus terlaksana pada bulan berjalan.',
  },
  {
    key: "konten_story",
    no: 3,
    name: "Jumlah Konten Story",
    short: "Story",
    unit: "Konten",
    source: "design",
    fixedTarget: CONTENT_TARGET,
    designType: "Instagram Story",
    measure: 'Pengajuan Design jenis "Instagram Story" yang berstatus terlaksana pada bulan berjalan.',
  },
  {
    key: "engagement",
    no: 4,
    name: "Like + Komentar + Share + Save",
    short: "Engagement",
    unit: "Interaksi",
    source: "instagram",
    fixedTarget: null,
    measure: "Total interaksi dari Instagram. Target = capaian bulan lalu + 10%.",
  },
  {
    key: "follower_growth",
    no: 5,
    name: "Follower Growth",
    short: "Follower",
    unit: "Follower",
    source: "instagram",
    fixedTarget: null,
    measure: "PERTAMBAHAN BERSIH follower bulan itu, bukan total. Target = pertambahan bulan lalu + 10%.",
  },
  {
    key: "views",
    no: 6,
    name: "Views",
    short: "Views",
    unit: "Views",
    source: "instagram",
    fixedTarget: null,
    measure: "Views dari Instagram (menggantikan Impressions sejak April 2025). Target = bulan lalu + 10%.",
  },
  {
    key: "profile_visit",
    no: 7,
    name: "Profile Visit",
    short: "Profile Visit",
    unit: "Kunjungan",
    source: "instagram",
    fixedTarget: null,
    measure: "Kunjungan profil dari Instagram. Target = bulan lalu + 10%.",
  },
  {
    key: "kecepatan",
    no: 8,
    name: "Kecepatan & Ketepatan",
    short: "Kecepatan",
    unit: "%",
    source: "design",
    fixedTarget: 100,
    measure: "Persentase pengajuan design yang selesai sebelum atau tepat pada deadline (plannedDate).",
  },
];

export const CREATIVE_KPI_BY_KEY = Object.fromEntries(
  CREATIVE_KPI_INDICATORS.map((i) => [i.key, i]),
) as Record<CreativeKpiKey, CreativeKpiIndicator>;

/**
 * Bobot bawaan — persis seperti yang diminta.
 *
 * Jumlahnya 90, BUKAN 100. Itu memang begitu dari sumbernya, dan sengaja tidak
 * "ditambal" dengan indikator karangan: skor akhir dinormalkan ke total bobot
 * yang benar-benar dinilai (lihat `creativeTotalScore`), jadi nilai 100 tetap
 * bisa dicapai. Bobotnya bisa diubah admin lewat Pengaturan.
 */
export const DEFAULT_CREATIVE_WEIGHTS: Record<CreativeKpiKey, number> = {
  konten_post: 10,
  konten_reels: 10,
  konten_story: 5,
  engagement: 15,
  follower_growth: 15,
  views: 10,
  profile_visit: 10,
  kecepatan: 15,
};

/**
 * Pengaturan KPI Creative — siapa timnya dan berapa bobotnya.
 *
 * Tim sosmed ditentukan di sini, bukan dari jabatan, karena orang yang
 * mengerjakan konten Instagram tidak selalu ber-jabatan "Social Media" — dan
 * daftar ini yang menentukan pengajuan design siapa saja yang dihitung SERTA
 * siapa yang melihat KPI ini sebagai KPI-nya sendiri.
 *
 * Daftar kosong berarti "seluruh PIC yang mengerjakan design" — supaya KPI
 * tetap ada isinya sebelum sempat diatur.
 */
export interface CreativeKpiSettings {
  /** User id anggota tim sosmed. */
  teamIds: string[];
  weights: Record<CreativeKpiKey, number>;
}

export const DEFAULT_CREATIVE_SETTINGS: CreativeKpiSettings = {
  teamIds: [],
  weights: { ...DEFAULT_CREATIVE_WEIGHTS },
};

/** Bersihkan pengaturan dari basis data — kunci asing dibuang, bobot dijepit. */
export function mergeCreativeSettings(raw: unknown): CreativeKpiSettings {
  const o = (raw ?? {}) as Partial<CreativeKpiSettings>;
  const weights = { ...DEFAULT_CREATIVE_WEIGHTS };
  const given = (o.weights ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(weights) as CreativeKpiKey[]) {
    const v = Number(given[key]);
    if (Number.isFinite(v) && v >= 0) weights[key] = Math.min(v, 100);
  }
  const teamIds = Array.isArray(o.teamIds) ? [...new Set(o.teamIds.filter((t) => typeof t === "string" && t))] : [];
  return { teamIds, weights };
}

/** Angka mentah Instagram untuk satu bulan (diisi tangan, nanti dari API). */
export interface SosmedMetrics {
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  followerGrowth: number;
  views: number;
  profileVisits: number;
}

export const EMPTY_METRICS: SosmedMetrics = {
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  followerGrowth: 0,
  views: 0,
  profileVisits: 0,
};

/** Like + Komentar + Share + Save digabung jadi satu angka engagement. */
export const engagementOf = (m: SosmedMetrics): number => m.likes + m.comments + m.shares + m.saves;

/** Realisasi satu indikator Instagram dari angka mentahnya. */
export function metricValue(key: CreativeKpiKey, m: SosmedMetrics): number {
  switch (key) {
    case "engagement":
      return engagementOf(m);
    case "follower_growth":
      return m.followerGrowth;
    case "views":
      return m.views;
    case "profile_visit":
      return m.profileVisits;
    default:
      return 0;
  }
}

/* ─────────────────────────── pengenalan jenis konten ─────────────────────────── */

/** Kunci indikator konten, atau null kalau bukan konten sosmed. */
export type ContentKind = "konten_post" | "konten_reels" | "konten_story";

/**
 * Kenali jenis konten dari teks `designType` yang bebas.
 *
 * Tidak bisa dicocokkan persis dengan `DESIGN_TYPES`: form Pengajuan Design
 * punya pilihan "Lainnya" yang membiarkan orang mengetik sendiri, dan datanya
 * memang sudah berisi tulisan bebas. Pencocokan persis akan melewatkan
 * "IG Story" atau "story instagram" — dan melewatkannya berarti KPI seseorang
 * turun tanpa ada yang tahu kenapa.
 *
 * Dicocokkan per KATA, bukan per potongan huruf: "Poster / Print Out"
 * mengandung "post" tetapi jelas bukan Instagram Post.
 */
export function classifyContent(designType: string | null | undefined): ContentKind | null {
  if (!designType) return null;
  const tokens = designType
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  // Reels diperiksa lebih dulu: "reels feed" harus jadi Reels, bukan Post.
  if (tokens.some((t) => t.startsWith("reel"))) return "konten_reels";
  if (tokens.some((t) => t.startsWith("stor"))) return "konten_story"; // story, stories, storie
  if (tokens.some((t) => t === "post" || t === "posts" || t === "feed" || t === "feeds")) return "konten_post";
  return null;
}

/* ─────────────────────────── rumus target ─────────────────────────── */

/** Target bulan ini dari capaian bulan lalu: bulan lalu + 10%. */
export const growthTarget = (previous: number) => Math.round(previous * (1 + GROWTH_RATE));

/* ─────────────────────────── perhitungan skor ─────────────────────────── */

/**
 * Capaian satu indikator, dalam persen 0–100.
 *
 * Menyalin rumus spreadsheet — `MIN(actual/target, 1)`, jadi kelebihan capaian
 * TIDAK menambah nilai — dengan satu perbedaan yang disengaja:
 *
 * Di spreadsheet, target 0 menghasilkan 0. Itu penjaga #DIV/0, bukan kebijakan:
 * di sana target 0 cuma terjadi karena salah ketik. Di aplikasi, target 0
 * terjadi SISTEMATIS setiap kali bulan lalu benar-benar nol — dan memberi 0
 * kepada tim yang naik dari nol ke 5.000 interaksi jelas keliru. Maka: target 0
 * dengan realisasi di atas nol dihitung tercapai penuh.
 *
 * Beda kasus dengan "belum ada baseline sama sekali" (bulan pertama) — itu
 * ditangani `scored: false`, bukan di sini.
 */
export function creativeCapaian(target: number, realisasi: number): number {
  if (realisasi <= 0) return 0;
  if (target <= 0) return 100;
  return Math.round(Math.min(realisasi / target, 1) * 10000) / 100;
}

/** Kontribusi ke skor = bobot × capaian. */
export function creativeAktual(weight: number, capaian: number): number {
  return Math.round(((weight * Math.min(capaian, 100)) / 100) * 100) / 100;
}

export interface CreativeKpiRow {
  indicator: CreativeKpiIndicator;
  weight: number;
  target: number;
  realisasi: number;
  capaian: number;
  aktual: number;
  /**
   * Apakah indikator ini ikut dihitung bulan ini.
   *
   * Indikator Instagram butuh angka bulan SEBELUMNYA untuk punya target. Bulan
   * pertama pemakaian, baseline itu belum ada — dan menilai sesuatu yang tidak
   * punya target adalah mengarang. Barisnya tetap tampil (supaya kelihatan apa
   * yang belum bisa dinilai) tapi tidak ikut menekan skor.
   */
  scored: boolean;
}

/**
 * Skor akhir 0–100, dinormalkan ke bobot yang benar-benar dinilai.
 *
 * Normalisasi ini menyelesaikan dua hal sekaligus: bobot bawaan yang berjumlah
 * 90 (bukan 100), dan indikator Instagram yang belum punya baseline di bulan
 * pertama. Tanpa itu, skor sempurna akan mentok di 90 — atau di 40 pada bulan
 * pertama — dan angkanya jadi tidak berarti apa-apa.
 */
export function creativeTotalScore(rows: CreativeKpiRow[]): number {
  const scored = rows.filter((r) => r.scored);
  const totalWeight = scored.reduce((s, r) => s + r.weight, 0);
  if (totalWeight <= 0) return 0;
  const earned = scored.reduce((s, r) => s + r.aktual, 0);
  return Math.round((earned / totalWeight) * 10000) / 100;
}

export type CreativeKpiTone = "success" | "brand" | "warning" | "danger";

/** Interpretasi hasil — ambang sama dengan KPI Human Capital & Coordinator Area. */
export function creativeKpiCategory(score: number): { label: string; tone: CreativeKpiTone; action: string } {
  if (score >= 95) return { label: "SANGAT BAIK", tone: "success", action: "Pertahankan ritme posting dan kualitas kontennya." };
  if (score >= 80) return { label: "BAIK", tone: "brand", action: "Cek indikator yang masih di bawah target bulan ini." };
  if (score >= 65) return { label: "CUKUP", tone: "warning", action: "Susun rencana konten dengan jadwal yang lebih ketat." };
  return { label: "PERLU PERBAIKAN", tone: "danger", action: "Evaluasi bersama Head Creative — cek beban kerja dan deadline." };
}

/* ─────────────────────────── periode ─────────────────────────── */

export const CREATIVE_MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const creativePeriod = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

export function creativePeriodLabel(period: string): string {
  const [y, m] = period.split("-");
  return `${CREATIVE_MONTHS[Number(m) - 1] ?? m} ${y}`;
}

/** Periode sebelum `period` — dipakai mengambil baseline target. */
export function previousPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Apakah tanggal ISO ini jatuh di dalam periode "YYYY-MM". */
export function inPeriod(iso: string | null | undefined, period: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 7) === period;
}

export const fmtNum = (n: number) => Math.round(n || 0).toLocaleString("id-ID");
