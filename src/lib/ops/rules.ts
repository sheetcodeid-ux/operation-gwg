import type { StatusNilai } from "./kpi-sales";

/**
 * MESIN ATURAN V.1 — menentukan ARTI sebuah angka KPI, bukan angkanya.
 *
 * ┌─ DUA HAL YANG TIDAK BOLEH MENEMPEL ──────────────────────────────────────┐
 * │                                                                          │
 * │   kpi_values.nilai   20.364919      ← fakta                              │
 * │   kondisi            "aman"         ← tafsir                             │
 * │                                                                          │
 * │ Tafsirnya tidak pernah disimpan ke dalam angkanya. Kalau menempel,       │
 * │ mengubah kebijakan berarti mengubah sejarah: laporan September yang      │
 * │ sudah dibaca orang akan berbeda artinya begitu ambang Desember           │
 * │ ditetapkan, tanpa satu pun jejak bahwa yang berubah adalah aturannya,    │
 * │ bukan kinerjanya.                                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ VERSI DIPILIH OLEH PERIODE KPI, BUKAN OLEH HARI INI ────────────────────┐
 * │                                                                          │
 * │ Menilai September memakai aturan yang berlaku untuk September — bukan    │
 * │ aturan yang kebetulan berlaku saat laporannya dibuka. Itulah yang        │
 * │ membuat penilaian lama tetap bisa dihasilkan ulang setelah aturannya     │
 * │ berganti.                                                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ OPERATOR MENYATAKAN PELANGGARAN, BUKAN KESEHATAN ───────────────────────┐
 * │                                                                          │
 * │ `gt 5` berarti "dilanggar bila LEBIH DARI 5" — jadi tepat 5 masih aman.  │
 * │ Bentuk ini diambil dari contoh di `blueprint.md` bagian 8, dan ia yang   │
 * │ membuat perilaku di titik batas tidak pernah jadi tebakan. Aturan yang   │
 * │ ingin menganggap 5 sudah melanggar memakai `gte`, dan itu keputusan yang │
 * │ tertulis di barisnya sendiri — bukan di kode ini.                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * MURNI — tanpa basis data, tanpa `server-only`, tanpa waktu sekarang. Seluruh
 * masukannya disuntikkan pemanggil, jadi hasilnya bisa diuji dan diulang.
 *
 * BUKAN Signal. Berkas ini berhenti di kondisi. Yang memutuskan sebuah kondisi
 * layak jadi sinyal, siapa yang ditugasi, dan kapan kedaluwarsa adalah phase
 * berikutnya.
 */

/* ─────────────────────────── bentuk data ─────────────────────────── */

/** Operator menyatakan kapan ambangnya DILANGGAR. */
export type Operator = "lt" | "lte" | "gt" | "gte" | "between";

export type Severity = "low" | "medium" | "high" | "critical";

/**
 * Kesimpulan untuk satu angka KPI.
 *
 * `tanpa_aturan` sengaja dibedakan dari `aman`. Sewa sebelum Oktober 2026 tidak
 * punya aturan V.1 sama sekali (AD-02), dan menyebutnya "aman" berarti
 * mengklaim ia sudah dinilai dan lolos — padahal belum pernah dinilai.
 */
export type Kondisi = "aman" | "lewat_ambang" | "tidak_tersedia" | "invalid" | "tanpa_aturan";

export interface SyaratAturan {
  urutan: number;
  operator: Operator;
  nilaiAmbang: number;
  nilaiAmbang2: number | null;
  skala: string;
}

export interface VersiAturan {
  ruleKode: string;
  versi: number;
  /** "YYYY-MM". */
  berlakuMulai: string;
  /** "YYYY-MM"; null berarti masih berlaku. */
  berlakuSampai: string | null;
  severity: Severity;
  /** Dari mana angkanya — ikut dikembalikan supaya penilaian bisa dijelaskan. */
  sumber: string;
  syarat: readonly SyaratAturan[];
}

export interface MasukanEvaluasi {
  /** "YYYY-MM" — periode KPI-nya, bukan hari ini. */
  periode: string;
  nilai: number | null;
  status: StatusNilai;
  /** Seluruh versi aturan untuk satu KPI. Urutannya tidak penting. */
  versi: readonly VersiAturan[];
}

export interface HasilEvaluasi {
  kondisi: Kondisi;
  ruleKode: string | null;
  versi: number | null;
  operator: Operator | null;
  nilaiAmbang: number | null;
  nilaiAmbang2: number | null;
  severity: Severity | null;
  sumber: string | null;
  /** Kalimat siap baca — supaya "kenapa" tidak perlu dicari di kode sumber. */
  alasan: string;
}

/* ─────────────────────────── pemilihan versi ─────────────────────────── */

/** Periode berada di dalam rentang berlakunya. Batas bawah dan atas IKUT. */
export function berlakuUntuk(v: VersiAturan, periode: string): boolean {
  if (periode < v.berlakuMulai) return false;
  return v.berlakuSampai === null || periode <= v.berlakuSampai;
}

/**
 * Versi yang berlaku untuk sebuah periode.
 *
 * Melempar bila ada lebih dari satu. Basis data sudah menolak rentang yang
 * bertumpang lewat pemicunya sendiri; pemeriksaan di sini jaring kedua, dan ia
 * penting justru karena yang dijaga adalah pertanyaan "aturan mana yang
 * dipakai". Pertanyaan itu tidak boleh dijawab oleh urutan baris.
 */
export function versiBerlaku(versi: readonly VersiAturan[], periode: string): VersiAturan | null {
  const cocok = versi.filter((v) => berlakuUntuk(v, periode));
  if (cocok.length > 1) {
    const daftar = cocok.map((v) => `${v.ruleKode} v${v.versi}`).join(", ");
    throw new Error(`lebih dari satu versi aturan berlaku untuk ${periode}: ${daftar}`);
  }
  return cocok[0] ?? null;
}

/* ─────────────────────────── pelanggaran ─────────────────────────── */

/**
 * Angka ini melanggar syaratnya?
 *
 * Titik batasnya eksplisit di tiap operator, dan itu satu-satunya tempat
 * perilakunya ditentukan:
 *
 *   gt  30  →  30 aman, 30.000001 melanggar
 *   gte 30  →  30 sudah melanggar
 *   lt  30  →  30 aman, 29.999999 melanggar
 *   lte 30  →  30 sudah melanggar
 *   between →  melanggar bila berada DI LUAR [ambang, ambang2]
 */
export function melanggar(nilai: number, s: SyaratAturan): boolean {
  switch (s.operator) {
    case "gt":
      return nilai > s.nilaiAmbang;
    case "gte":
      return nilai >= s.nilaiAmbang;
    case "lt":
      return nilai < s.nilaiAmbang;
    case "lte":
      return nilai <= s.nilaiAmbang;
    case "between":
      // `between` dipakai aturan yang sehatnya berada di dalam rentang.
      return s.nilaiAmbang2 === null ? false : nilai < s.nilaiAmbang || nilai > s.nilaiAmbang2;
  }
}

const kalimat = (s: SyaratAturan): string => {
  const a = s.nilaiAmbang;
  switch (s.operator) {
    case "gt":
      return `ambangnya ${a}% dan dilanggar bila lebih dari itu`;
    case "gte":
      return `ambangnya ${a}% dan dilanggar bila mencapai atau melebihinya`;
    case "lt":
      return `ambangnya ${a}% dan dilanggar bila kurang dari itu`;
    case "lte":
      return `ambangnya ${a}% dan dilanggar bila sama atau kurang dari itu`;
    case "between":
      return `sehatnya antara ${a}% dan ${s.nilaiAmbang2}%`;
  }
};

/* ─────────────────────────── evaluasi ─────────────────────────── */

const kosong = (kondisi: Kondisi, alasan: string): HasilEvaluasi => ({
  kondisi,
  ruleKode: null,
  versi: null,
  operator: null,
  nilaiAmbang: null,
  nilaiAmbang2: null,
  severity: null,
  sumber: null,
  alasan,
});

/**
 * Nilai satu angka KPI terhadap aturan yang berlaku untuk periodenya.
 *
 * Urutan pemeriksaannya disengaja: keadaan ANGKANYA diperiksa lebih dulu,
 * baru ada-tidaknya aturan. Angka yang tidak ada tetap "tidak tersedia"
 * sekalipun aturannya lengkap — dan itu yang perlu dibaca orang, bukan
 * keterangan soal aturan yang tidak akan dipakai.
 */
export function evaluasi(m: MasukanEvaluasi): HasilEvaluasi {
  if (m.status === "invalid") {
    return kosong("invalid", "Angkanya ditandai tidak sah, jadi tidak dinilai terhadap aturan mana pun.");
  }
  if (m.status === "tidak_tersedia" || m.nilai === null) {
    return kosong("tidak_tersedia", "Angkanya belum ada, jadi tidak ada yang bisa dinilai. Ini BUKAN berarti aman.");
  }
  if (!Number.isFinite(m.nilai)) {
    return kosong("invalid", "Angkanya bukan bilangan terhingga.");
  }

  const v = versiBerlaku(m.versi, m.periode);
  if (!v) {
    return kosong("tanpa_aturan", `Belum ada aturan yang berlaku untuk periode ${m.periode}. Belum dinilai — bukan aman.`);
  }

  const syarat = [...v.syarat].sort((a, b) => a.urutan - b.urutan);
  if (syarat.length === 0) {
    return kosong("tanpa_aturan", `${v.ruleKode} v${v.versi} tidak punya satu pun syarat.`);
  }

  // Satu syarat yang dilanggar sudah cukup. Aturan V.1 hari ini seluruhnya
  // bersyarat tunggal; bentuk jamaknya disiapkan karena blueprint bagian 8
  // memang menyebut `urutan` dan `penggabung`.
  const dilanggar = syarat.find((s) => melanggar(m.nilai as number, s));
  const dipakai = dilanggar ?? syarat[0];

  return {
    kondisi: dilanggar ? "lewat_ambang" : "aman",
    ruleKode: v.ruleKode,
    versi: v.versi,
    operator: dipakai.operator,
    nilaiAmbang: dipakai.nilaiAmbang,
    nilaiAmbang2: dipakai.nilaiAmbang2,
    severity: v.severity,
    sumber: v.sumber,
    alasan: `${m.nilai} terhadap ${v.ruleKode} v${v.versi}: ${kalimat(dipakai)} — ${dilanggar ? "dilanggar" : "tidak dilanggar"}.`,
  };
}
