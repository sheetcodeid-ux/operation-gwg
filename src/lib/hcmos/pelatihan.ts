/**
 * Modul Pelatihan (LMS) & rekap batch Fast Start / Fast Track.
 *
 * Dua hal berbeda yang sering dicampur, dan pemisahannya di sini disengaja:
 *
 *  • KURIKULUM — daftar modul beserta bentuk dan durasinya. Ini keputusan
 *    Learning & Development, ditulis di `lanjutan.ts`, tidak dihitung.
 *  • PELAKSANAAN — siapa yang sudah mengikuti modul apa, batch mana, dan
 *    nilainya berapa. Semuanya dibaca dari `hc_training_records`.
 *
 * Status sebuah modul ("Belum dijadwalkan / Berjalan / Selesai") adalah
 * TURUNAN dari pelaksanaan, bukan kolom yang diketik. Sempat terpikir
 * menyimpannya sebagai kolom status di kurikulum, dan itu keliru: status yang
 * diketik berhenti berubah saat pesertanya bertambah, sehingga sebuah modul
 * tetap tertulis "Selesai" padahal ada batch baru yang belum dinilai — dan
 * tidak ada yang menyadarinya sampai seseorang menghitung ulang sendiri.
 */

import { MATERI_FAST_TRACK, MATERI_MANAJEMEN, lulus } from "./lanjutan";
import type { HcScope } from "./pillars";

export interface ModulKurikulum {
  no: number;
  judul: string;
  bentuk: string;
  menit: number;
}

/** Kurikulum yang berlaku untuk sebuah scope. */
export function kurikulumScope(scope: HcScope): readonly ModulKurikulum[] {
  return scope === "manajemen" ? MATERI_MANAJEMEN : MATERI_FAST_TRACK;
}

/** Sasaran peserta tiap kurikulum — dipakai kolom "Target Peserta". */
export const TARGET_PESERTA: Record<HcScope, string> = {
  manajemen: "Staf Manajemen (Office & Warehouse)",
  outlet: "Crew Outlet — Fast Start & Fast Track",
};

/** Satu baris `hc_training_records`, sudah dibersihkan dari bentuk mentahnya. */
export interface RekamanPelatihan {
  nama: string;
  materi: string;
  program: string;
  batch: string;
  outletName: string | null;
  tanggal: string | null;
  postTest: number | null;
}

export type StatusModul = "belum" | "berjalan" | "selesai";

export const STATUS_MODUL_META: Record<StatusModul, { label: string; tone: "neutral" | "warning" | "success" }> = {
  belum: { label: "Belum dijadwalkan", tone: "neutral" },
  berjalan: { label: "Berjalan", tone: "warning" },
  selesai: { label: "Selesai", tone: "success" },
};

/**
 * Status sebuah modul dari daftar pesertanya.
 *
 * Tanpa peserta = belum dijadwalkan. Ada peserta yang Post Test-nya belum
 * diisi = masih berjalan. Semua sudah dinilai = selesai. Perhatikan bahwa
 * "selesai" TIDAK berarti semuanya lulus — kelulusan ditanyakan terpisah.
 */
export function statusModul(peserta: { postTest: number | null }[]): StatusModul {
  if (peserta.length === 0) return "belum";
  return peserta.some((p) => p.postTest === null) ? "berjalan" : "selesai";
}

export interface BarisModul extends ModulKurikulum {
  target: string;
  peserta: number;
  lulus: number;
  status: StatusModul;
}

/** Kurikulum sebuah scope, disandingkan dengan pelaksanaannya. */
export function ringkasModul(scope: HcScope, rekaman: RekamanPelatihan[]): BarisModul[] {
  const target = TARGET_PESERTA[scope];
  return kurikulumScope(scope).map((m) => {
    // Judul materi diketik tangan saat mencatat peserta, jadi pencocokannya
    // dilonggarkan huruf besar-kecil dan spasi tepi — bukan pencocokan longgar
    // yang menebak-nebak, hanya normalisasi yang aman.
    const peserta = rekaman.filter((r) => samaJudul(r.materi, m.judul));
    return {
      ...m,
      target,
      peserta: peserta.length,
      lulus: peserta.filter((p) => lulus(p.postTest) === true).length,
      status: statusModul(peserta),
    };
  });
}

const samaJudul = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export interface BarisBatch {
  batch: string;
  program: string[];
  peserta: number;
  dinilai: number;
  lulus: number;
  /** Persen kelulusan dari yang SUDAH dinilai; null bila belum ada yang dinilai. */
  persenLulus: number | null;
  mulai: string | null;
  selesai: string | null;
  status: StatusModul;
}

/**
 * Rekap per batch.
 *
 * Peserta dihitung per ORANG, bukan per baris: satu crew mengikuti sepuluh
 * materi dan karenanya punya sepuluh baris. Menghitung barisnya membuat batch
 * berisi tiga orang terbaca sebagai tiga puluh peserta.
 */
export function ringkasBatch(rekaman: RekamanPelatihan[]): BarisBatch[] {
  const per = new Map<string, RekamanPelatihan[]>();
  for (const r of rekaman) {
    const key = r.batch.trim() || "Tanpa Batch";
    per.set(key, [...(per.get(key) ?? []), r]);
  }

  return [...per.entries()]
    .map(([batch, isi]) => {
      const orang = new Set(isi.map((r) => r.nama.trim().toLowerCase()).filter(Boolean));
      const dinilai = isi.filter((r) => r.postTest !== null);
      const jumlahLulus = dinilai.filter((r) => lulus(r.postTest) === true).length;
      const tanggal = isi.map((r) => r.tanggal).filter((d): d is string => !!d).sort();
      return {
        batch,
        program: [...new Set(isi.map((r) => r.program).filter(Boolean))].sort(),
        peserta: orang.size,
        dinilai: dinilai.length,
        lulus: jumlahLulus,
        persenLulus: dinilai.length === 0 ? null : Math.round((jumlahLulus / dinilai.length) * 100),
        mulai: tanggal[0] ?? null,
        selesai: tanggal[tanggal.length - 1] ?? null,
        status: statusModul(isi.map((r) => ({ postTest: r.postTest }))),
      };
    })
    .sort((a, b) => (b.mulai ?? "").localeCompare(a.mulai ?? "") || a.batch.localeCompare(b.batch, "id"));
}

/**
 * Tren kelulusan per batch — urut dari batch terlama ke terbaru.
 *
 * Batch yang belum ada nilainya sama sekali tidak dimasukkan; menaruhnya
 * sebagai nol membuat grafik terbaca seolah seluruh pesertanya gagal.
 */
export function trenKelulusan(batch: BarisBatch[]): { nama: string; nilai: number }[] {
  return batch
    .filter((b) => b.persenLulus !== null)
    .slice()
    .sort((a, b) => (a.mulai ?? "").localeCompare(b.mulai ?? "") || a.batch.localeCompare(b.batch, "id"))
    .map((b) => ({ nama: b.batch, nilai: b.persenLulus as number }));
}

/** Sebaran jalur Fast Track per brand outlet — berapa crew per brand. */
export function fastTrackPerBrand(
  rekaman: RekamanPelatihan[],
  brandDari: (namaOutlet: string) => string,
): { nama: string; nilai: number }[] {
  const per = new Map<string, Set<string>>();
  for (const r of rekaman) {
    if (r.program !== "fast_track") continue;
    const brand = brandDari(r.outletName ?? "") || "Tanpa Brand";
    if (!per.has(brand)) per.set(brand, new Set());
    per.get(brand)!.add(r.nama.trim().toLowerCase());
  }
  return [...per.entries()]
    .map(([nama, orang]) => ({ nama, nilai: orang.size }))
    .sort((a, b) => b.nilai - a.nilai);
}

/** Jumlah orang berbeda (bukan jumlah baris) dalam sekumpulan rekaman. */
export const jumlahPeserta = (rekaman: RekamanPelatihan[]): number =>
  new Set(rekaman.map((r) => r.nama.trim().toLowerCase()).filter(Boolean)).size;
