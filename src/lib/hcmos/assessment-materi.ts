/**
 * Pre Test & Post Test — rekap penilaian tiap materi Fast Start / Fast Track.
 *
 * Satu materi dijalani tiga tahap: Pre Test (sebelum materi), Role Play
 * (praktik), lalu Post Test (20 menit, sesudah materi). Yang menentukan lulus
 * hanyalah Post Test; Pre Test adalah GARIS DASAR — dipakai untuk mengukur
 * seberapa jauh pesertanya berpindah, bukan untuk meluluskan atau menggugurkan.
 *
 * Ini bukan detail sepele. Kalau Pre Test ikut menentukan kelulusan, orang yang
 * sudah tahu materinya sejak awal dinilai sama dengan orang yang belajar paling
 * banyak, dan pelatihannya kehilangan satu-satunya ukuran yang benar-benar
 * mengukur pelatihan itu sendiri.
 *
 * Semua di berkas ini murni hitungan — tidak menyentuh basis data, tidak
 * menyimpan apa pun. Status "Selesai / Berjalan / Belum Mulai" adalah TURUNAN
 * dari ada-tidaknya nilai, bukan kolom yang diketik.
 */

import { DURASI_POST_TEST_MENIT, MATERI_FAST_TRACK, NILAI_LULUS, lulus } from "./lanjutan";
import type { RekamanPelatihan } from "./pelatihan";

export const TAHAP_ASSESSMENT = ["pre", "role_play", "post"] as const;
export type TahapAssessment = (typeof TAHAP_ASSESSMENT)[number];

export const LABEL_TAHAP: Record<TahapAssessment, string> = {
  pre: "Pre Test",
  role_play: "Role Play",
  post: `Post Test (${DURASI_POST_TEST_MENIT} menit)`,
};

export type StatusTahap = "belum" | "berjalan" | "selesai";

export const STATUS_TAHAP_META: Record<StatusTahap, { label: string; tone: "neutral" | "warning" | "success" }> = {
  belum: { label: "Belum Mulai", tone: "neutral" },
  berjalan: { label: "Berjalan", tone: "warning" },
  selesai: { label: "Selesai", tone: "success" },
};

export type HasilKelulusan = "menunggu" | "lulus" | "belum_lulus";

export const HASIL_META: Record<HasilKelulusan, { label: string; tone: "neutral" | "success" | "danger" }> = {
  menunggu: { label: "Menunggu", tone: "neutral" },
  lulus: { label: "Lulus", tone: "success" },
  belum_lulus: { label: "Belum Lulus", tone: "danger" },
};

/**
 * Status satu tahap dari nilai pesertanya.
 *
 * Tidak ada peserta sama sekali = belum mulai. Sebagian sudah bernilai =
 * berjalan. Semua bernilai = selesai.
 */
export function statusTahap(nilai: (number | null)[]): StatusTahap {
  if (nilai.length === 0) return "belum";
  const terisi = nilai.filter((n) => n !== null).length;
  if (terisi === 0) return "belum";
  return terisi === nilai.length ? "selesai" : "berjalan";
}

/** Rata-rata satu desimal; null bila tidak ada satu pun nilai. */
export function rerata(nilai: (number | null)[]): number | null {
  const ada = nilai.filter((n): n is number => n !== null && Number.isFinite(n));
  if (ada.length === 0) return null;
  return Math.round((ada.reduce((a, b) => a + b, 0) / ada.length) * 10) / 10;
}

export interface BarisAssessment {
  no: number;
  judul: string;
  bentuk: string;
  menit: number;
  peserta: number;
  pre: number | null;
  statusPre: StatusTahap;
  statusRolePlay: StatusTahap;
  post: number | null;
  statusPost: StatusTahap;
  /**
   * Nilai akumulasi materi ini = nilai Post Test-nya.
   *
   * Sengaja tidak dicampur dengan Pre Test. Merata-ratakan keduanya membuat
   * peserta yang berangkat dari nol dan naik jauh terlihat lebih buruk daripada
   * peserta yang sejak awal sudah tahu dan tidak belajar apa-apa.
   */
  akumulasi: number | null;
  hasil: HasilKelulusan;
  /** Selisih Post − Pre; null bila salah satunya belum ada. */
  peningkatan: number | null;
}

const samaJudul = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Sepuluh materi Fast Start / Fast Track, disandingkan dengan nilai pesertanya. */
export function ringkasAssessment(rekaman: RekamanPelatihan[]): BarisAssessment[] {
  return MATERI_FAST_TRACK.map((m) => {
    const peserta = rekaman.filter((r) => samaJudul(r.materi, m.judul));
    const pre = rerata(peserta.map((p) => p.preTest));
    const post = rerata(peserta.map((p) => p.postTest));
    const statusPost = statusTahap(peserta.map((p) => p.postTest));
    return {
      no: m.no,
      judul: m.judul,
      bentuk: m.bentuk,
      menit: m.menit,
      peserta: peserta.length,
      pre,
      statusPre: statusTahap(peserta.map((p) => p.preTest)),
      statusRolePlay: statusTahap(peserta.map((p) => p.rolePlay)),
      post,
      statusPost,
      akumulasi: post,
      // Belum semua Post Test-nya masuk berarti belum bisa disebut lulus atau
      // tidak — angkanya masih bisa berpindah sisi ambang.
      hasil: statusPost !== "selesai" || post === null ? "menunggu" : lulus(post) ? "lulus" : "belum_lulus",
      peningkatan: pre === null || post === null ? null : Math.round((post - pre) * 10) / 10,
    };
  });
}

export interface RingkasProgram {
  totalMateri: number;
  durasiPostTest: number;
  nilaiMinimum: number;
  /** Materi yang seluruh Post Test-nya sudah dinilai. */
  materiSelesai: number;
  /** Rata-rata nilai akumulasi dari materi yang sudah selesai. */
  akumulasiProgram: number | null;
  rerataPre: number | null;
  rerataPost: number | null;
  rerataPeningkatan: number | null;
  /** Program dinyatakan lulus hanya bila SELURUH materi sudah selesai. */
  hasilProgram: HasilKelulusan;
}

/**
 * Ringkasan seluruh program dari rekap per materi.
 *
 * Rata-rata Pre dan Post dihitung dari materi yang PUNYA keduanya, bukan dari
 * seluruh materi. Kalau tidak, materi yang Pre Test-nya sudah masuk tapi Post
 * Test-nya belum ikut menarik rata-rata Post ke bawah, dan peningkatannya
 * terbaca lebih kecil dari yang sebenarnya.
 */
export function ringkasProgram(baris: BarisAssessment[]): RingkasProgram {
  const selesai = baris.filter((b) => b.statusPost === "selesai" && b.akumulasi !== null);
  const berpasangan = baris.filter((b) => b.peningkatan !== null);
  const akumulasi = rerata(selesai.map((b) => b.akumulasi));
  return {
    totalMateri: baris.length,
    durasiPostTest: DURASI_POST_TEST_MENIT,
    nilaiMinimum: NILAI_LULUS,
    materiSelesai: selesai.length,
    akumulasiProgram: akumulasi,
    rerataPre: rerata(berpasangan.map((b) => b.pre)),
    rerataPost: rerata(berpasangan.map((b) => b.post)),
    rerataPeningkatan: rerata(berpasangan.map((b) => b.peningkatan)),
    hasilProgram:
      selesai.length < baris.length || akumulasi === null
        ? "menunggu"
        : lulus(akumulasi)
          ? "lulus"
          : "belum_lulus",
  };
}

/** Tahapan penilaian, ditulis sekali dan dibaca halaman Pre/Post Test. */
export const ALUR_ASSESSMENT = [
  {
    judul: "Pre Test",
    isi: "Uji pemahaman awal sebelum materi diberikan, untuk mengukur baseline peserta.",
  },
  {
    judul: "Role Play",
    isi: "Simulasi atau praktik langsung per materi, dinilai Trainer atau Supervisor.",
  },
  {
    judul: "Post Test",
    isi: `Uji pemahaman akhir tertulis atau online — berdurasi ${DURASI_POST_TEST_MENIT} menit per materi.`,
  },
  {
    judul: "Perbandingan & Akumulasi Nilai",
    isi: `Nilai Pre Test dibandingkan dengan Post Test, lalu Post Test seluruh materi dirata-ratakan jadi nilai akhir.`,
  },
  {
    judul: "Sertifikasi Kelulusan",
    isi: `Terbit setelah seluruh materi selesai dan nilai akumulasinya memenuhi standar minimal ${NILAI_LULUS}.`,
  },
];

/** Aturan main yang perlu diketahui pembaca halaman, agar angkanya tidak salah dibaca. */
export const CARA_KERJA_AKUMULASI = [
  {
    judul: `${MATERI_FAST_TRACK.length} materi berbobot sama`,
    isi: MATERI_FAST_TRACK.map((m) => m.judul).join(", ") + ".",
  },
  {
    judul: "Pre Test adalah garis dasar, bukan syarat kelulusan",
    isi: "Dijalankan sebelum materi dan Role Play dimulai; gunanya dibandingkan dengan Post Test untuk mengukur peningkatan.",
  },
  {
    judul: `Post Test berdurasi ${DURASI_POST_TEST_MENIT} menit per materi`,
    isi: `Total ${DURASI_POST_TEST_MENIT * MATERI_FAST_TRACK.length} menit bila seluruh Post Test ditempuh.`,
  },
  {
    judul: "Nilai akumulasi = rata-rata Post Test seluruh materi",
    isi: "Dihitung otomatis dari nilai yang sudah masuk — tidak diketik terpisah, jadi tidak bisa tertinggal saat nilainya berubah.",
  },
  {
    judul: `Standar kelulusan minimal ${NILAI_LULUS}`,
    isi: `Peserta dengan nilai akumulasi di bawah ${NILAI_LULUS} mengulang Post Test materi yang nilainya kurang.`,
  },
];
