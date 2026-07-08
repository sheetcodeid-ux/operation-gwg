/**
 * Static configuration + pure scoring helpers for the HRD grade-promotion
 * assessment ("Sistem Penilaian Kenaikan Golongan").
 *
 * FRONTEND-ONLY: everything here is deterministic, in-memory data derived from
 * the HR spec. No database or server calls — the backend/DB layer is wired
 * later. Keeping the model + math in one pure module makes that migration a
 * drop-in (persist these shapes; the scoring stays identical).
 */

export type EvaluatorKey = "al" | "hc" | "dir";
export type ParamKey = "kpi" | "att" | "loy" | "skl" | "kon" | "msk";
export type DimensionKey = "kont" | "visi" | "siap" | "komit";

export interface ScoreOption {
  value: number;
  head: string;
  body: string;
  src?: string;
}

export interface Parameter {
  key: ParamKey;
  title: string;
  weight: number; // % contribution to an evaluator's score (sums to 100)
  scale: number; // max selectable value (min is always 1)
  source: string;
  options: ScoreOption[];
}

export interface Evaluator {
  key: EvaluatorKey;
  no: number;
  name: string;
  weight: number; // % contribution to the final score (sums to 100)
  note: string;
}

/**
 * Positions assessed by a single official evaluator — the Director (100%).
 * Heads of every division fall here too (see `evaluatorsFor`).
 */
export const DIRECTOR_ONLY_POSITIONS = ["Legal", "Business Development", "Sekretaris"];

/** The three official evaluators and their weight toward the final score. */
export const EVALUATORS: Evaluator[] = [
  {
    key: "al",
    no: 1,
    name: "Atasan Langsung",
    weight: 40,
    note: "Diisi berdasarkan observasi langsung minimal 3 bulan terakhir. Setiap pilihan harus dapat didukung bukti atau contoh konkret.",
  },
  {
    key: "hc",
    no: 2,
    name: "HC / Human Capital",
    weight: 35,
    note: "Diisi berdasarkan data sistem HR (absensi, SP, tes kompetensi) dan verifikasi dokumen pendukung.",
  },
  {
    key: "dir",
    no: 3,
    name: "Director",
    weight: 25,
    note: "Diisi berdasarkan pertimbangan strategis dan dampak kontribusi karyawan terhadap perusahaan secara keseluruhan.",
  },
];

/** The six scored parameters. Weights sum to 100 within each evaluator. */
export const PARAMETERS: Parameter[] = [
  {
    key: "kpi",
    title: "KPI Performa",
    weight: 30,
    scale: 3,
    source: "Laporan KPI bulanan terverifikasi. Ambil rata-rata capaian 3 bulan terakhir.",
    options: [
      { value: 3, head: "Nilai 3 — Sangat Baik", body: "Capaian KPI ≥ 95% rata-rata 3 bulan terakhir. Konsisten memenuhi atau melampaui target.", src: "Indeks 100% → kontribusi skor: 30 poin" },
      { value: 2, head: "Nilai 2 — Baik", body: "Capaian KPI 80–94% rata-rata 3 bulan terakhir. Ada bulan di bawah target namun segera diperbaiki.", src: "Indeks 67% → kontribusi skor: 20 poin" },
      { value: 1, head: "Nilai 1 — Perlu Perbaikan", body: "Capaian KPI di bawah 80%. Ada pola tidak konsisten atau penurunan berulang.", src: "Indeks 33% → kontribusi skor: 10 poin" },
    ],
  },
  {
    key: "att",
    title: "Attitude & Leadership",
    weight: 20,
    scale: 3,
    source: "Form 360° (self + peer + atasan). Minimum 3 responden peer. Diisi tiap 6 bulan.",
    options: [
      { value: 3, head: "Nilai 3 — Baik & Stabil", body: "Inisiatif tinggi tanpa diminta, menjadi panutan di tim, komunikasi proaktif, mampu membimbing rekan lebih junior.", src: "Form 360° rata-rata ≥ 4.0/5 dari ≥ 3 peer" },
      { value: 2, head: "Nilai 2 — Cukup", body: "Kooperatif dan tidak menimbulkan masalah, namun cenderung pasif — perlu arahan. Tidak ada inisiatif nyata yang menonjol.", src: "Form 360° rata-rata 2.5–3.9/5" },
      { value: 1, head: "Nilai 1 — Perlu Perhatian", body: "Ada gesekan dengan rekan tim, komunikasi tidak lancar, atau pernah ada laporan konflik yang tercatat.", src: "Form 360° rata-rata <2.5/5 atau catatan insiden" },
    ],
  },
  {
    key: "loy",
    title: "Loyalitas & Disiplin",
    weight: 15,
    scale: 4,
    source: "Sistem absensi digital (tidak dapat dimodifikasi manual) + catatan SP dari sistem HR.",
    options: [
      { value: 4, head: "Nilai 4 — Disiplin Tinggi, Tanpa SP", body: "0 SP aktif dalam 12 bulan terakhir. Alpa ≤ 2 hari/bulan. Tepat waktu > 95% hari kerja.", src: "Sumber: Sistem absensi + rekam SP HR" },
      { value: 3, head: "Nilai 3 — Disiplin Standar", body: "0 SP aktif. Alpa 3–5 hari/bulan. Umumnya tepat waktu, keterlambatan sesekali dan tidak berulang.", src: "Sumber: Sistem absensi + rekam SP HR" },
      { value: 2, head: "Nilai 2 — Pernah Teguran Ringan", body: "Pernah menerima SP Lisan atau SP-1 yang sudah selesai masa berlakunya. Alpa 6–8 hari/bulan.", src: "Sumber: Rekam SP HR (status: tidak aktif)" },
      { value: 1, head: "Nilai 1 — SP Aktif Berlaku", body: "SP-2 atau SP-3 masih aktif berlaku. Atau alpa > 8 hari/bulan dalam 3 bulan terakhir.", src: "Sumber: Rekam SP HR (status: aktif)" },
    ],
  },
  {
    key: "skl",
    title: "Skill & Kompetensi",
    weight: 15,
    scale: 5,
    source: "Tes kompetensi tahunan + observasi atasan + portofolio kerja. Sertifikasi relevan jadi nilai tambah.",
    options: [
      { value: 5, head: "Nilai 5 — Expert & Bisa Melatih", body: "Menjadi trainer internal, memiliki sertifikasi relevan yang diakui, menguasai seluruh aspek jabatan, mampu mengembangkan SOP/modul baru.", src: "Tes ≥ 90/100 + rekam training" },
      { value: 4, head: "Nilai 4 — Sangat Kompeten", body: "Mandiri penuh, ada inovasi atau perbaikan proses, mampu handle kompleksitas tinggi tanpa arahan.", src: "Tes 85–89/100 + portofolio" },
      { value: 3, head: "Nilai 3 — Standar Jabatan", body: "Memenuhi seluruh job description, kadang butuh arahan untuk kasus-kasus khusus.", src: "Tes 70–84/100" },
      { value: 2, head: "Nilai 2 — Perlu Banyak Arahan", body: "Sering meminta bantuan untuk tugas yang seharusnya sudah dikuasai dalam jabatan ini.", src: "Tes 50–69/100" },
      { value: 1, head: "Nilai 1 — Di Bawah Standar", body: "Tidak berkembang, di bawah standar jabatan, ada pola kesalahan berulang.", src: "Tes <50/100 atau catatan koreksi berulang" },
    ],
  },
  {
    key: "kon",
    title: "Kontribusi ke Perusahaan",
    weight: 10,
    scale: 4,
    source: "Laporan kontribusi 6 bulan dari atasan + bukti nyata (proyek, inovasi, penghematan). Wajib ada dokumentasi.",
    options: [
      { value: 4, head: "Nilai 4 — Dampak Signifikan", body: "Ada inovasi/proyek dengan dampak terukur (angka) pada efisiensi, revenue, atau penghematan biaya.", src: "Bukti dokumentasi yang dapat diverifikasi" },
      { value: 3, head: "Nilai 3 — Normal Job Desk", body: "Semua tugas standar selesai tepat waktu dan berkualitas. Tidak ada backlog dalam 6 bulan.", src: "Laporan kontribusi atasan" },
      { value: 2, head: "Nilai 2 — Minim", body: "Pola revisi berulang, kualitas di bawah standar, atau backlog tugas yang tidak diselesaikan.", src: "Catatan atasan" },
      { value: 1, head: "Nilai 1 — Tidak Ada", body: "Tugas diambil alih orang lain, atau tidak ada output yang dapat dipakai tanpa perbaikan besar.", src: "Catatan atasan" },
    ],
  },
  {
    key: "msk",
    title: "Masa Kerja",
    weight: 10,
    scale: 5,
    source: "Otomatis dari sistem HR — tanggal bergabung (kontrak / BPJS ketenagakerjaan / payroll).",
    options: [
      { value: 5, head: "Nilai 5 — Lebih dari 5 tahun", body: "Pengalaman panjang memberikan konteks dan loyalitas yang bernilai.", src: "Otomatis dari sistem HR" },
      { value: 4, head: "Nilai 4 — 3–5 tahun", body: "Sudah melewati fase adaptasi, memiliki pemahaman mendalam tentang perusahaan.", src: "Otomatis dari sistem HR" },
      { value: 3, head: "Nilai 3 — 2–3 tahun", body: "Cukup berpengalaman untuk naik golongan dengan performa yang mendukung.", src: "Otomatis dari sistem HR" },
      { value: 2, head: "Nilai 2 — 1–2 tahun", body: "Masih dalam fase pengembangan, kenaikan golongan memerlukan performa luar biasa.", src: "Otomatis dari sistem HR" },
      { value: 1, head: "Nilai 1 — Kurang dari 1 tahun", body: "Terlalu awal untuk kenaikan golongan reguler. Hanya dipertimbangkan jika ada alasan sangat kuat.", src: "Otomatis dari sistem HR" },
    ],
  },
];

/** Interview dimensions (scored 1–4). Weights sum to 100. */
export interface Dimension {
  key: DimensionKey;
  no: number;
  title: string;
  weight: number;
  guide: string[];
  options: ScoreOption[];
}

function ivOptions(labels: [string, string, string, string]): ScoreOption[] {
  return [
    { value: 4, head: `Nilai 4 — ${labels[0]}`, body: "", src: "Indeks 100 poin" },
    { value: 3, head: `Nilai 3 — ${labels[1]}`, body: "", src: "Indeks 75 poin" },
    { value: 2, head: `Nilai 2 — ${labels[2]}`, body: "", src: "Indeks 50 poin" },
    { value: 1, head: `Nilai 1 — ${labels[3]}`, body: "", src: "Indeks 25 poin" },
  ];
}

export const DIMENSIONS: Dimension[] = [
  {
    key: "kont",
    no: 1,
    title: "Kontribusi Nyata & Terukur",
    weight: 30,
    guide: [
      "Ceritakan satu kontribusi terbesar Anda untuk perusahaan dalam 6 bulan terakhir. Apa hasilnya yang bisa Anda ukur?",
      "Apakah ada proyek atau inisiatif yang Anda pimpin atau inisiasi? Bagaimana dampaknya?",
      "Bagaimana pekerjaan Anda berdampak pada tim atau departemen lain?",
    ],
    options: ivOptions([
      "Kontribusi luar biasa dengan bukti terukur dan konkret",
      "Kontribusi solid, dijelaskan dengan jelas dan konsisten",
      "Kontribusi terbatas, penjelasan kurang spesifik",
      "Tidak dapat menjelaskan kontribusi yang berarti",
    ]),
  },
  {
    key: "visi",
    no: 2,
    title: "Alignment Visi & Nilai Perusahaan",
    weight: 20,
    guide: [
      "Menurut Anda, apa nilai-nilai inti perusahaan kita? Bagaimana Anda menerapkannya sehari-hari?",
      "Di mana Anda melihat perusahaan 3 tahun ke depan? Bagaimana peran Anda di dalamnya?",
      "Ceritakan situasi di mana keputusan Anda mencerminkan nilai-nilai perusahaan.",
    ],
    options: ivOptions([
      "Sangat selaras dan aktif memperjuangkan nilai perusahaan",
      "Memahami dan konsisten menerapkan nilai perusahaan",
      "Pemahaman terbatas, selaras tapi tidak mendalam",
      "Tidak menunjukkan alignment dengan visi perusahaan",
    ]),
  },
  {
    key: "siap",
    no: 3,
    title: "Kesiapan Tanggung Jawab Lebih Besar",
    weight: 25,
    guide: [
      "Apa yang membuat Anda merasa siap untuk tanggung jawab pada golongan/level berikutnya?",
      "Bagaimana Anda menangani rekan/bawahan yang kinerjanya di bawah standar?",
      "Bagaimana Anda mengelola emosi saat menerima kritik atau teguran dari atasan?",
    ],
    options: ivOptions([
      "Sangat siap, menunjukkan kematangan dan kepemimpinan",
      "Siap, menunjukkan potensi kepemimpinan yang jelas",
      "Cukup siap namun masih perlu pendampingan",
      "Belum menunjukkan kesiapan untuk level berikutnya",
    ]),
  },
  {
    key: "komit",
    no: 4,
    title: "Komitmen Pengembangan Diri & Tim",
    weight: 25,
    guide: [
      "Apa yang sedang Anda pelajari atau kembangkan untuk mendukung karier Anda?",
      "Bagaimana Anda membantu rekan/junior berkembang?",
      "Di mana Anda melihat posisi Anda di perusahaan ini dalam 3–5 tahun ke depan?",
    ],
    options: ivOptions([
      "Komitmen kuat, aktif mengembangkan diri dan tim",
      "Berkomitmen mengembangkan diri secara konsisten",
      "Ada niat berkembang namun belum terstruktur",
      "Belum menunjukkan komitmen pengembangan yang nyata",
    ]),
  },
];

export type IvRecValue = "sangat_layak" | "layak" | "tunda" | "tidak_layak";

export interface IvRecommendation {
  value: IvRecValue;
  /** Short label for chips/dropdowns (no emoji). */
  short: string;
  label: string;
  body: string;
}

export const IV_RECOMMENDATIONS: IvRecommendation[] = [
  { value: "sangat_layak", short: "Sangat Layak", label: "Sangat Layak — Interview memperkuat rekomendasi", body: "Karyawan tampil melampaui ekspektasi. Interview menemukan bukti tambahan yang memperkuat kelayakan kenaikan golongan." },
  { value: "layak", short: "Layak", label: "Layak — Interview mendukung keputusan berdasarkan skor", body: "Karyawan tampil sesuai ekspektasi. Tidak ada informasi baru yang mengubah rekomendasi berdasarkan skor penilaian." },
  { value: "tunda", short: "Perlu Pertimbangan", label: "Perlu Pertimbangan Ulang", body: "Ada beberapa hal dari interview yang perlu diklarifikasi atau dipertimbangkan lebih lanjut sebelum keputusan final." },
  { value: "tidak_layak", short: "Tidak Direkomendasikan", label: "Tidak Direkomendasikan — Interview mengungkap concern serius", body: "Sesi interview mengungkap concern serius sehingga tidak direkomendasikan untuk naik golongan periode ini, terlepas dari skor." },
];

/** Favourability rank (higher = better) — used to break interview-vote ties. */
export const IV_RANK: Record<IvRecValue, number> = { sangat_layak: 4, layak: 3, tunda: 2, tidak_layak: 1 };

/**
 * Final interview recommendation from each evaluator's vote:
 * the majority (most-picked) wins; on a tie — including all-different — take the
 * median option by favourability rank (the balanced middle choice).
 */
export function resolveInterviewRec(votes: IvRecValue[]): IvRecValue | null {
  if (!votes.length) return null;
  const freq = new Map<IvRecValue, number>();
  for (const v of votes) freq.set(v, (freq.get(v) ?? 0) + 1);
  const maxFreq = Math.max(...freq.values());
  const modes = [...freq.entries()].filter(([, c]) => c === maxFreq).map(([v]) => v);
  if (modes.length === 1) return modes[0];
  const sorted = [...votes].sort((a, b) => IV_RANK[a] - IV_RANK[b]);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

export interface GradeTier {
  min: number;
  max: number;
  label: string;
  tone: "no" | "wait" | "ok" | "fast";
  action: string;
}

export const GRADE_TIERS: GradeTier[] = [
  { min: 0, max: 69.999, label: "Tidak Layak", tone: "no", action: "Evaluasi menyeluruh + program pengembangan intensif minimum 6 bulan. HC wajib membuat IDP (Individual Development Plan)." },
  { min: 70, max: 84.999, label: "Ditunda — 6 Bulan", tone: "wait", action: "Identifikasi 1–2 parameter paling lemah. Buat rencana perbaikan spesifik + coaching bulanan. Review resmi 6 bulan kemudian." },
  { min: 85, max: 95, label: "Layak Naik Golongan", tone: "ok", action: "Proses kenaikan golongan dapat dilanjutkan. Atasan menyiapkan surat rekomendasi → HC memproses administrasi → Director/GM tanda tangan." },
  { min: 95.001, max: 100, label: "Fast Track (Opsional)", tone: "fast", action: "Berlaku jika 2 syarat fast track terpenuhi. Diskusikan dengan manajemen senior untuk pertimbangan promosi jabatan." },
];

export interface Syarat {
  id: number;
  label: string;
  sub: string;
  confirm: string;
}

export const SYARAT_UTAMA: Syarat[] = [
  { id: 1, label: "Masa Kerja Minimal 6 Bulan", sub: "Karyawan telah bekerja minimal 6 (enam) bulan terhitung sejak tanggal bergabung hingga tanggal assessment.", confirm: "Ya, masa kerja ≥ 6 bulan — terverifikasi dari sistem HR" },
  { id: 2, label: "Tidak Sedang Menjalani Sanksi Disiplin", sub: "Tidak sedang dalam status SP aktif — SP Lisan, SP-1, SP-2, maupun SP-3 — pada tanggal assessment.", confirm: "Ya, tidak ada SP aktif — terverifikasi dari rekam HC" },
  { id: 3, label: "Belum Pernah Assessment di Periode yang Sama", sub: "Belum pernah mengikuti assessment kenaikan golongan pada periode/siklus yang sama di tahun kalender berjalan.", confirm: "Ya, belum ada assessment di periode yang sama tahun ini" },
];

/** The 7-step flow shown on the Panduan tab. */
export const FLOW_STEPS: { no: number; title: string; desc: string }[] = [
  { no: 1, title: "Verifikasi Syarat Utama", desc: "Cek 3 syarat wajib. Jika ada yang tidak terpenuhi, proses dihentikan." },
  { no: 2, title: "Self Assessment", desc: "Karyawan menilai diri sendiri secara jujur sebagai bahan kalibrasi." },
  { no: 3, title: "Penilaian Atasan Langsung", desc: "Penilai 1 (bobot 40%) mengisi 6 parameter berdasarkan observasi langsung." },
  { no: 4, title: "Penilaian HC", desc: "Penilai 2 (bobot 35%) mengisi berdasarkan data sistem HR." },
  { no: 5, title: "Penilaian Director", desc: "Penilai 3 (bobot 25%) mengisi berdasarkan pertimbangan strategis." },
  { no: 6, title: "Interview Akhir", desc: "HC/Director memverifikasi kontribusi & kesiapan lewat 4 dimensi interview." },
  { no: 7, title: "Dashboard Final", desc: "Skor agregat dihitung, gap antar penilai dianalisis, keputusan final direkomendasikan." },
];

/** A sample candidate so the frontend renders with realistic content. */
export const MOCK_CANDIDATE = {
  nama: "Budi Santoso",
  nik: "EMP-2019-0123",
  jabatan: "Staff Senior Operasional",
  golongan: "II-B",
  golonganTujuan: "III-A",
  departemen: "Operations",
  masaKerja: 4, // index into masa-kerja scale
};

// ─────────────────────────── scoring helpers ───────────────────────────

export type ParamScores = Partial<Record<ParamKey, number>>;
export type EvaluatorScores = Record<EvaluatorKey, ParamScores>;
export type DimensionScores = Partial<Record<DimensionKey, number>>;

const PARAM_BY_KEY = new Map(PARAMETERS.map((p) => [p.key, p]));

/**
 * Which official evaluators score a given position. Heads and the
 * DIRECTOR_ONLY_POSITIONS are assessed by the Director alone (weight 100%);
 * everyone else by the standard trio (40/35/25).
 */
export function evaluatorsFor(pos: { isHead: boolean; title: string } | null | undefined): Evaluator[] {
  if (pos && (pos.isHead || DIRECTOR_ONLY_POSITIONS.includes(pos.title))) {
    const dir = EVALUATORS.find((e) => e.key === "dir")!;
    return [{ ...dir, weight: 100 }];
  }
  return EVALUATORS;
}

/** True when a position is scored by the Director only. */
export function isDirectorOnly(pos: { isHead: boolean; title: string } | null | undefined): boolean {
  return !!pos && (pos.isHead || DIRECTOR_ONLY_POSITIONS.includes(pos.title));
}

/** An evaluator's 0–100 score from their six parameter picks (blank = 0). */
export function evaluatorScore(scores: ParamScores): number {
  let total = 0;
  for (const p of PARAMETERS) {
    const v = scores[p.key];
    if (!v) continue;
    total += (v / p.scale) * 100 * (p.weight / 100);
  }
  return Math.round(total * 100) / 100;
}

/** How many of an evaluator's parameters have been filled. */
export function evaluatorFilled(scores: ParamScores): number {
  return PARAMETERS.filter((p) => !!scores[p.key]).length;
}

/** Weighted final score across the active evaluators (0–100). */
export function finalScore(all: EvaluatorScores, evaluators: Evaluator[] = EVALUATORS): number {
  let total = 0;
  for (const e of evaluators) {
    total += evaluatorScore(all[e.key]) * (e.weight / 100);
  }
  return Math.round(total * 100) / 100;
}

/** Interview score (0–100) from the four dimension picks. */
export function interviewScore(scores: DimensionScores): number {
  let total = 0;
  for (const d of DIMENSIONS) {
    const v = scores[d.key];
    if (!v) continue;
    total += (v / 4) * 100 * (d.weight / 100);
  }
  return Math.round(total * 100) / 100;
}

export function gradeTier(score: number): GradeTier {
  return GRADE_TIERS.find((t) => score >= t.min && score <= t.max) ?? GRADE_TIERS[0];
}

/**
 * Fast-track needs score > 95, a measurable financial impact, and Attitude=3
 * from ≥2 evaluators (or the sole evaluator when a position is Director-only).
 */
export function fastTrackEligible(
  all: EvaluatorScores,
  financialImpact: boolean,
  evaluators: Evaluator[] = EVALUATORS,
): boolean {
  const score = finalScore(all, evaluators);
  const attTop = evaluators.filter((e) => all[e.key].att === 3).length;
  const need = evaluators.length >= 2 ? 2 : 1;
  return score > 95 && financialImpact && attTop >= need;
}

/** A single parameter's contribution (poin) for the given pick. */
export function paramContribution(key: ParamKey, value: number | undefined): number {
  const p = PARAM_BY_KEY.get(key);
  if (!p || !value) return 0;
  return Math.round((value / p.scale) * 100 * (p.weight / 100) * 10) / 10;
}

export function emptyEvaluatorScores(): EvaluatorScores {
  return { al: {}, hc: {}, dir: {} };
}
