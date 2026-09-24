import "server-only";

import { db, dbEnabled } from "./db";

/**
 * WORK Z-02 — SATU-SATUNYA JALAN TULIS, DAN SELURUHNYA LEWAT RPC.
 *
 * ┌─ KENAPA TIDAK ADA SATU PUN `.from("works").update(...)` DI SINI ─────────┐
 * │                                                                          │
 * │ Membuat Work menyentuh TIGA tabel sekaligus, dan mengubah owner menuntut │
 * │ riwayatnya lahir di transaksi yang sama. PostgREST tidak punya transaksi │
 * │ lintas permintaan: dua permintaan terpisah akan meninggalkan Work tanpa  │
 * │ pelaksana, atau perubahan tanpa jejak — dan tidak ada yang terlihat      │
 * │ salah dari luar.                                                         │
 * │                                                                          │
 * │ Keenam fungsi `gwg_*` pada `0116` sudah menjadi batas transaksinya.      │
 * │ Berkas ini memanggilnya, menerjemahkan jawabannya, dan tidak menghitung  │
 * │ apa pun sendiri.                                                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ YANG SENGAJA TIDAK ADA DI SINI ─────────────────────────────────────────┐
 * │                                                                          │
 * │   otorisasi        milik `src/lib/actions/work-signal.ts`                │
 * │   invariant        milik `0114`/`0115`/`0116` (I-01 … I-28)              │
 * │   hitung tenggat   milik `gwg_buat_work` — kebijakan Z02-SLA-v1          │
 * │   mesin status     milik trigger `works_mutasi_tercatat`                 │
 * │                                                                          │
 * │ Menyalin salah satunya ke sini berarti dua aturan untuk satu hal, dan    │
 * │ yang kedua akan menyimpang diam-diam.                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/* ───────────────────────────── bentuk jawaban ───────────────────────────── */

/**
 * Kelas kegagalan, dan HANYA kelasnya.
 *
 * Pesan galat basis data berbahasa Indonesia dan menjelaskan dirinya sendiri,
 * tetapi ia menyebut nama tabel, nomor baris, dan nama fungsi — tidak satu pun
 * yang pantas sampai ke layar. Yang menyeberang kelasnya; kalimatnya dirakit
 * lapisan aksi.
 */
export type GagalWork =
  | "db_mati"
  | "tidak_ditemukan"
  | "terminal"
  | "sudah_dilepas"
  | "terakhir"
  | "alasan_wajib"
  | "transisi_tidak_sah"
  | "bukan_owner"
  | "benturan_peran"
  | "masukan_tidak_sah"
  | "gagal";

export type HasilWork<T> = { ok: true; hasil: T } | { ok: false; alasan: GagalWork };

export interface JawabanBuatWork {
  id: number;
  tenggat: string;
  jumlah_signal: number;
  jumlah_executor: number;
  berubah: boolean;
}
export interface JawabanKaitan {
  work_id: number;
  signal_id: number;
  berubah: boolean;
}
export interface JawabanPelaksana {
  work_id: number;
  user_id: string;
  aksi: string;
  berubah: boolean;
}
export interface JawabanUbahWork {
  id: number;
  berubah: boolean;
}
export interface JawabanStatus {
  id: number;
  status: string;
  berubah: boolean;
}

/* ─────────────────────────── terjemahan galat ─────────────────────────── */

/**
 * Petakan pesan basis data ke kelas kegagalan.
 *
 * ┌─ KENAPA DICOCOKKAN DARI PESANNYA, BUKAN DARI KODE GALAT ─────────────────┐
 * │                                                                          │
 * │ AD-20 · F mengunci bahwa fungsi penulis memakai `raise exception` biasa  │
 * │ TANPA SQLSTATE khusus — seluruhnya P0001. Kelasnya memang dibedakan dari │
 * │ pesannya, dan itu keputusan yang sudah dikunci, bukan kelalaian.         │
 * │                                                                          │
 * │ Urutannya penting: yang lebih khusus diperiksa lebih dulu. Yang tidak    │
 * │ dikenali jatuh ke `gagal` — tidak ditebak, dan tidak diteruskan apa      │
 * │ adanya ke layar.                                                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
const PETA: ReadonlyArray<readonly [RegExp, GagalWork]> = [
  [/tidak ditemukan/i, "tidak_ditemukan"],
  [/sudah (completed|cancelled)|dibuka kembali/i, "terminal"],
  [/pernah dilepas|sudah tercatat dan tidak boleh diubah/i, "sudah_dilepas"],
  [/terakhir .* tidak boleh dilepas/i, "terakhir"],
  [/transisi status/i, "transisi_tidak_sah"],
  [/hanya tercatat atas nama ownernya/i, "bukan_owner"],
  [/tidak boleh sekaligus|masih menjadi pelaksana aktif/i, "benturan_peran"],
  [/wajib beralasan|wajib disertai riwayat/i, "alasan_wajib"],
  [/tidak dikenal|wajib diisi|wajib disebut|sedikitnya satu|belum punya departemen|tidak boleh kosong|sudah tidak aktif|tidak pernah ditugaskan/i, "masukan_tidak_sah"],
];

export function klasifikasiGalatWork(pesan: string): GagalWork {
  for (const [pola, kelas] of PETA) if (pola.test(pesan)) return kelas;
  return "gagal";
}

async function panggil<T>(nama: string, argumen: Record<string, unknown>): Promise<HasilWork<T>> {
  if (!dbEnabled) return { ok: false, alasan: "db_mati" };
  try {
    const { data, error } = await db().rpc(nama, argumen);
    if (error) return { ok: false, alasan: klasifikasiGalatWork(error.message ?? "") };
    if (!data) return { ok: false, alasan: "gagal" };
    return { ok: true, hasil: data as T };
  } catch {
    return { ok: false, alasan: "gagal" };
  }
}

/* ─────────────────────────────── enam penulis ─────────────────────────────── */

/**
 * Buat Work baru dari sedikitnya satu Signal dan satu pelaksana.
 *
 * Tenggatnya TIDAK dihitung di sini: `gwg_buat_work` yang memilikinya, memakai
 * kebijakan `Z02-SLA-v1` dengan titik tolak waktu pembuatan (O-02, O-04).
 * Menghitungnya di sini berarti dua kebijakan tenggat untuk satu perusahaan.
 */
export function buatWork(m: {
  judul: string;
  deskripsi: string;
  owner: string;
  departemen: string;
  kategori: string;
  signalIds: number[];
  executorIds: string[];
  oleh: string;
}): Promise<HasilWork<JawabanBuatWork>> {
  return panggil<JawabanBuatWork>("gwg_buat_work", {
    p_judul: m.judul,
    p_deskripsi: m.deskripsi,
    p_owner: m.owner,
    p_departemen: m.departemen,
    p_kategori: m.kategori,
    p_signal_ids: m.signalIds,
    p_executor_ids: m.executorIds,
    p_oleh: m.oleh,
  });
}

/** Kaitkan satu Signal yang sudah ada ke Work yang belum terminal. */
export function kaitkanSignalWork(workId: number, signalId: number, oleh: string): Promise<HasilWork<JawabanKaitan>> {
  return panggil<JawabanKaitan>("gwg_kaitkan_signal_work", { p_work_id: workId, p_signal_id: signalId, p_oleh: oleh });
}

/**
 * Lepaskan kaitan Signal — LUNAK, dan tidak dapat ditarik kembali (I-26).
 * Barisnya tidak pernah dihapus; ia ditandai beserta alasannya.
 */
export function lepasSignalWork(workId: number, signalId: number, alasan: string, oleh: string): Promise<HasilWork<JawabanKaitan>> {
  return panggil<JawabanKaitan>("gwg_lepas_signal_work", {
    p_work_id: workId,
    p_signal_id: signalId,
    p_alasan: alasan,
    p_oleh: oleh,
  });
}

/**
 * Tambah atau lepas pelaksana.
 *
 * Tidak ada arah ketiga: pelaksana yang sudah dilepas TIDAK dapat ditugaskan
 * ulang (I-28), dan barisnya tidak pernah dihapus (I-27).
 */
export function kelolaPelaksanaWork(
  workId: number,
  userId: string,
  aksi: "tambah" | "lepas",
  oleh: string,
): Promise<HasilWork<JawabanPelaksana>> {
  return panggil<JawabanPelaksana>("gwg_kelola_executor_work", {
    p_work_id: workId,
    p_user_id: userId,
    p_aksi: aksi,
    p_oleh: oleh,
  });
}

/**
 * Ubah owner, departemen utama, dan/atau tenggat.
 *
 * `null` berarti "tidak diubah". Riwayatnya disisipkan fungsi itu sendiri
 * SEBELUM `works` diperbarui — urutan yang dituntut T-F (I-19, I-20).
 */
export function ubahWork(m: {
  workId: number;
  owner: string | null;
  departemen: string | null;
  tenggat: string | null;
  alasan: string | null;
  oleh: string;
}): Promise<HasilWork<JawabanUbahWork>> {
  return panggil<JawabanUbahWork>("gwg_ubah_work", {
    p_work_id: m.workId,
    p_owner: m.owner,
    p_departemen: m.departemen,
    p_tenggat: m.tenggat,
    p_alasan: m.alasan,
    p_oleh: m.oleh,
  });
}

/**
 * Pindahkan status Work.
 *
 * Mesin statusnya milik basis data (I-22), begitu pula kewajiban riwayat
 * (I-25) dan penjaga Owner pada penyelesaian (I-23). Yang di sini hanya
 * meneruskannya sebagai satu transaksi.
 */
export function ubahStatusWork(
  workId: number,
  status: string,
  alasan: string | null,
  oleh: string,
): Promise<HasilWork<JawabanStatus>> {
  return panggil<JawabanStatus>("gwg_ubah_status_work", {
    p_work_id: workId,
    p_status: status,
    p_alasan: alasan,
    p_oleh: oleh,
  });
}
