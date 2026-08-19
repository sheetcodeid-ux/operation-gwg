/**
 * Alur belajar satu materi — Self-Learning (LMS).
 *
 * Bentuknya mengikuti cara belajar yang sudah terbukti dipakai orang di luar
 * kantor (Ruang Guru dan sejenisnya), bukan sekadar "tonton lalu ujian":
 *
 *   masuk → Pre Test → Studi Kasus → Materi Utama → Post Test
 *
 * Kenapa berurutan, dan kenapa Pre Test justru di DEPAN materi:
 *
 *   Pre Test diambil sebelum orangnya belajar apa pun. Gunanya bukan menilai —
 *   nilainya memang biasanya jelek — melainkan menunjukkan JARAK: setelah Post
 *   Test, selisih dua angka itulah bukti materinya bekerja atau tidak. Kalau
 *   Pre Test boleh dikerjakan setelah menonton, angkanya kehilangan seluruh
 *   artinya dan tidak ada gunanya lagi disimpan.
 *
 *   Studi Kasus di antara keduanya membuat orangnya menemukan sendiri apa yang
 *   belum ia ketahui, sebelum diberi jawabannya di materi utama.
 *
 *   Post Test TERKUNCI sampai materi utama tuntas. Tanpa kunci itu, jalan
 *   tercepat menyelesaikan sebuah materi adalah melewatinya — dan itulah yang
 *   akan dilakukan orang yang sedang terburu-buru, setiap kali.
 *
 * Materi boleh diulang sebanyak apa pun. Yang TIDAK berubah adalah nilainya:
 * yang dipakai selalu percobaan PERTAMA. Memakai nilai terbaik berarti nilai
 * akhirnya hanya menunjukkan siapa yang paling telaten mengulang, bukan siapa
 * yang paham; dan Pre Test yang boleh diulang setelah menonton sama saja dengan
 * tidak punya Pre Test.
 */

/** Tahap yang dilalui satu materi, berurutan. */
export const FASE_BELAJAR = ["pre", "kasus", "materi", "post"] as const;
export type FaseBelajar = (typeof FASE_BELAJAR)[number];

/** Tahap yang berupa soal. "materi" bukan soal — ia bahan yang dipelajari. */
export const FASE_KUIS = ["pre", "kasus", "post"] as const;
export type FaseKuis = (typeof FASE_KUIS)[number];

export const LABEL_FASE: Record<FaseBelajar, string> = {
  pre: "Pre Test",
  kasus: "Studi Kasus",
  materi: "Materi Utama",
  post: "Post Test",
};

export const PENJELASAN_FASE: Record<FaseBelajar, string> = {
  pre: "Dikerjakan sebelum belajar. Nilainya jadi titik awal, bukan penilaian.",
  kasus: "Contoh kejadian nyata untuk dipikirkan sendiri sebelum materinya dibuka.",
  materi: "Materi utama. Ditonton sampai selesai sebelum Post Test bisa dibuka.",
  post: "Dikerjakan setelah materi selesai. Selisihnya dengan Pre Test itulah hasil belajarnya.",
};

/** Apakah sebuah nilai memang salah satu fase kuis. */
export function faseKuisValid(v: string): v is FaseKuis {
  return (FASE_KUIS as readonly string[]).includes(v);
}

export interface KeadaanFase {
  /** Fase ini punya soal yang benar-benar terisi. */
  adaKuis: Partial<Record<FaseKuis, boolean>>;
  /** Fase ini sudah pernah dikerjakan (percobaan pertama sudah tercatat). */
  sudahDikerjakan: Partial<Record<FaseKuis, boolean>>;
  /** Materi utama sudah tuntas — video habis ditonton atau ditandai selesai. */
  materiTuntas: boolean;
}

/**
 * Fase mana saja yang boleh dibuka sekarang.
 *
 * Fase yang TIDAK PUNYA SOAL tidak pernah menghalangi. Materi yang memang tidak
 * punya Studi Kasus tidak boleh membuat orangnya tertahan menunggu sesuatu yang
 * tidak ada — dan itu keadaan yang mustahil ia keluar sendiri.
 */
export function faseTerbuka(k: KeadaanFase): Record<FaseBelajar, boolean> {
  const perlu = (f: FaseKuis) => !!k.adaKuis[f];
  const lewat = (f: FaseKuis) => !perlu(f) || !!k.sudahDikerjakan[f];

  const pre = true;
  const kasus = lewat("pre");
  const materi = kasus && lewat("kasus");
  // Satu-satunya kunci yang benar-benar mengunci: Post Test menunggu materinya
  // tuntas, bukan menunggu fase sebelumnya dikerjakan.
  const post = materi && k.materiTuntas;

  return { pre, kasus, materi, post };
}

/** Fase yang seharusnya dikerjakan sekarang — yang pertama belum tuntas. */
export function faseBerjalan(k: KeadaanFase): FaseBelajar {
  if (k.adaKuis.pre && !k.sudahDikerjakan.pre) return "pre";
  if (k.adaKuis.kasus && !k.sudahDikerjakan.kasus) return "kasus";
  if (!k.materiTuntas) return "materi";
  return "post";
}

/** Sudah selesai seluruhnya: materi tuntas dan Post Test sudah dikerjakan. */
export function faseSelesai(k: KeadaanFase): boolean {
  return k.materiTuntas && (!k.adaKuis.post || !!k.sudahDikerjakan.post);
}

export interface Percobaan {
  /** Nomor percobaan, mulai 1. */
  attempt: number;
  score: number;
}

/**
 * Nilai yang dipakai: percobaan PERTAMA, bukan yang terbaik.
 *
 * Percobaan berikutnya tetap disimpan — riwayatnya berguna untuk melihat siapa
 * yang berusaha memperbaiki diri — tapi ia tidak menggeser angka resminya.
 */
export function nilaiResmi(percobaan: Percobaan[]): number | null {
  if (percobaan.length === 0) return null;
  return percobaan.reduce((a, b) => (b.attempt < a.attempt ? b : a)).score;
}

/**
 * Selisih Post Test terhadap Pre Test — inilah hasil belajarnya.
 *
 * `null` bila salah satunya belum dikerjakan: menampilkan "0" untuk yang belum
 * ada angkanya terbaca sebagai "tidak ada kemajuan", padahal artinya "belum
 * bisa dihitung".
 */
export function selisihBelajar(pre: number | null, post: number | null): number | null {
  if (pre === null || post === null) return null;
  return post - pre;
}

/**
 * Kunci hasil kuis: satu materi punya hasil terpisah untuk tiap tahap.
 *
 * Ditaruh di berkas ini, bukan di lapisan data, supaya server yang menyusun
 * petanya dan layar yang membacanya memakai bentuk kunci yang sama persis.
 * Kunci yang disusun ulang di sisi layar adalah cara paling mudah menghasilkan
 * "hasilnya kosong" padahal datanya ada.
 */
export const kunciHasil = (lessonId: string, fase: FaseKuis) => `${lessonId}::${fase}`;
