"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { ambilWorkUntukAksi } from "@/lib/data/work-baca";
import {
  buatWork,
  kaitkanSignalWork,
  kelolaPelaksanaWork,
  lepasSignalWork,
  ubahStatusWork,
  ubahWork,
  type GagalWork,
} from "@/lib/data/work-tulis";
import { canReachMenu, MENU_COMMAND_CENTER } from "@/lib/nav";
import { can } from "@/lib/rbac";
import type { UserProfile } from "@/lib/types";

/**
 * WORK Z-02 — ENAM TINDAKAN, DAN OTORISASINYA DIPUTUSKAN DI SINI.
 *
 * ┌─ AKTOR DATANG DARI SESI, TIDAK PERNAH DARI PEMANGGIL ────────────────────┐
 * │                                                                          │
 * │ Keenam fungsi `gwg_*` menerima `p_oleh`, dan `p_oleh` BUKAN autentikasi: │
 * │ fungsi itu berjalan sebagai service role dan tidak bisa membuktikan      │
 * │ siapa pemanggilnya (AD-20 · C). Kalau nilainya boleh datang dari         │
 * │ peramban, siapa pun bisa mencatatkan pekerjaan atas nama orang lain —    │
 * │ dan penjaga "penyelesaian hanya atas nama Owner" berubah jadi formalitas.│
 * │                                                                          │
 * │ Karena itu TIDAK SATU PUN action di berkas ini menerima id pengguna      │
 * │ sebagai parameter untuk dipakai sebagai aktor. `user.id` selalu berasal  │
 * │ dari `getSessionUser()`, dan itulah satu-satunya nilai yang diteruskan   │
 * │ sebagai `p_oleh`.                                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ DUA LAPIS, DAN YANG BAWAH YANG BERKUASA ────────────────────────────────┐
 * │                                                                          │
 * │ Pemeriksaan di sini untuk OTORISASI dan untuk pesan yang enak dibaca.    │
 * │ Seluruh invariant — I-01 … I-28 — tetap ditegakkan basis data, dan       │
 * │ jawabannya tetap final. Yang di sini tidak pernah menggantikannya.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

export type HasilAksiWork = { ok: true; berubah: boolean; id?: number } | { ok: false; pesan: string };

const DITOLAK = "Anda tidak memiliki akses untuk tindakan ini.";
const TAK_DIKENAL = "Work tidak dikenal.";

/**
 * Satu kalimat untuk tiap kelas kegagalan.
 *
 * Pesan basis data TIDAK diteruskan apa adanya: ia menyebut nomor baris, nama
 * fungsi, dan nama tabel. Yang sampai ke layar kalimat yang bisa ditindaklanjuti
 * orang yang menekan tombolnya.
 */
function pesanGagal(alasan: GagalWork): string {
  switch (alasan) {
    case "db_mati":
      return "Penyimpanan sedang tidak aktif.";
    case "tidak_ditemukan":
      return "Work atau Signal tidak ditemukan.";
    case "terminal":
      return "Work sudah selesai atau dibatalkan dan tidak dapat diubah lagi.";
    case "sudah_dilepas":
      return "Yang sudah dilepas tidak dapat diaktifkan kembali.";
    case "terakhir":
      return "Tidak dapat melepas yang terakhir — Work harus tetap punya Signal dan pelaksana.";
    case "alasan_wajib":
      return "Perubahan ini membutuhkan alasan.";
    case "transisi_tidak_sah":
      return "Perpindahan status itu tidak diizinkan.";
    case "bukan_owner":
      return "Penyelesaian Work hanya dapat dicatat atas nama pemiliknya.";
    case "benturan_peran":
      return "Pemilik Work tidak boleh sekaligus menjadi pelaksananya.";
    case "masukan_tidak_sah":
      return "Data yang dikirim belum lengkap atau tidak sah.";
    default:
      return "Gagal menyimpan. Coba lagi.";
  }
}

function segarkan(): void {
  revalidatePath("/operational/command-center");
}

const bersihkan = (s: string | null | undefined): string => (s ?? "").trim();
const idSah = (n: number): boolean => Number.isInteger(n) && n > 0;

/**
 * Pintu bersama untuk tindakan yang menyebut sebuah Work.
 *
 * Mengembalikan aktor DAN keadaan Work sekaligus, karena kontrak O-06 menyebut
 * dua hal yang hanya terbaca dari barisnya: "Owner saat itu" dan "pelaksana
 * aktif".
 */
async function konteks(
  workId: number,
): Promise<{ ok: true; user: UserProfile; ownerId: string; pelaksanaAktif: boolean } | { ok: false; pesan: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, pesan: DITOLAK };
  if (!idSah(workId)) return { ok: false, pesan: TAK_DIKENAL };

  const baca = await ambilWorkUntukAksi(workId, user.id);
  if (!baca.ok) {
    return { ok: false, pesan: baca.alasan === "tidak_ditemukan" ? TAK_DIKENAL : "Gagal membaca Work. Coba lagi." };
  }
  return { ok: true, user, ownerId: baca.work.ownerId, pelaksanaAktif: baca.work.pelaksanaAktif };
}

/* ─────────────────────────────── A · buat Work ─────────────────────────────── */

export interface MasukanBuatWork {
  judul: string;
  deskripsi: string;
  ownerId: string;
  departemen: string;
  tenggatKategori: string;
  signalIds: number[];
  executorIds: string[];
}

const KATEGORI_SAH = ["urgent", "high", "normal", "low"];

/**
 * Buat Work baru dari Signal.
 *
 * Izinnya `create_signal_work` — SENGAJA bukan `create_work_task`, yang
 * dipegang 12 dari 14 peran termasuk peran yang tidak boleh membuka
 * Operational V.1 sama sekali (AD-19 · O-06).
 */
export async function buatWorkAction(m: MasukanBuatWork): Promise<HasilAksiWork> {
  const user = await getSessionUser();
  if (!user) return { ok: false, pesan: DITOLAK };
  if (!canReachMenu(user, MENU_COMMAND_CENTER)) return { ok: false, pesan: DITOLAK };
  if (!can(user, "create_signal_work")) return { ok: false, pesan: DITOLAK };

  const judul = bersihkan(m?.judul);
  const departemen = bersihkan(m?.departemen);
  const ownerId = bersihkan(m?.ownerId);
  const signalIds = (m?.signalIds ?? []).filter(idSah);
  const executorIds = (m?.executorIds ?? []).map(bersihkan).filter((s) => s.length > 0);

  // Pemeriksaan di bawah untuk PENGALAMAN, bukan untuk keamanan: basis data
  // menolak hal yang sama, dan jawabannya tetap yang terakhir.
  if (judul.length === 0) return { ok: false, pesan: "Judul wajib diisi." };
  if (departemen.length === 0) return { ok: false, pesan: "Departemen utama wajib diisi." };
  if (ownerId.length === 0) return { ok: false, pesan: "Pemilik Work wajib dipilih." };
  if (!KATEGORI_SAH.includes(m?.tenggatKategori)) return { ok: false, pesan: "Kategori tenggat tidak dikenal." };
  if (signalIds.length === 0) return { ok: false, pesan: "Pilih sedikitnya satu Signal." };
  if (executorIds.length === 0) return { ok: false, pesan: "Pilih sedikitnya satu pelaksana." };

  const hasil = await buatWork({
    judul,
    deskripsi: bersihkan(m?.deskripsi),
    owner: ownerId,
    departemen,
    kategori: m.tenggatKategori,
    signalIds,
    executorIds,
    oleh: user.id,
  });
  if (!hasil.ok) return { ok: false, pesan: pesanGagal(hasil.alasan) };
  segarkan();
  return { ok: true, berubah: hasil.hasil.berubah, id: hasil.hasil.id };
}

/* ───────────────────────── B · kaitkan Signal ke Work ───────────────────────── */

/** Owner saat itu, atau pemegang `manage_signals`. */
export async function kaitkanSignalWorkAction(workId: number, signalId: number): Promise<HasilAksiWork> {
  const k = await konteks(workId);
  if (!k.ok) return k;
  if (k.user.id !== k.ownerId && !can(k.user, "manage_signals")) return { ok: false, pesan: DITOLAK };
  if (!idSah(signalId)) return { ok: false, pesan: "Signal tidak dikenal." };

  const hasil = await kaitkanSignalWork(workId, signalId, k.user.id);
  if (!hasil.ok) return { ok: false, pesan: pesanGagal(hasil.alasan) };
  segarkan();
  return { ok: true, berubah: hasil.hasil.berubah, id: workId };
}

/* ───────────────────────── C · lepas kaitan Signal ───────────────────────── */

/**
 * Hanya pemegang `manage_signals`.
 *
 * Alasannya WAJIB, dan pelepasannya tidak dapat ditarik kembali (I-26) —
 * gerbangnya karena itu sama dengan mengabaikan Signal, bukan dengan
 * mengaitkannya.
 */
export async function lepasSignalWorkAction(workId: number, signalId: number, alasan: string): Promise<HasilAksiWork> {
  const k = await konteks(workId);
  if (!k.ok) return k;
  if (!can(k.user, "manage_signals")) return { ok: false, pesan: DITOLAK };
  if (!idSah(signalId)) return { ok: false, pesan: "Signal tidak dikenal." };

  const bersih = bersihkan(alasan);
  if (bersih.length === 0) return { ok: false, pesan: "Alasan wajib diisi." };

  const hasil = await lepasSignalWork(workId, signalId, bersih, k.user.id);
  if (!hasil.ok) return { ok: false, pesan: pesanGagal(hasil.alasan) };
  segarkan();
  return { ok: true, berubah: hasil.hasil.berubah, id: workId };
}

/* ───────────────────────── D · tambah / lepas pelaksana ───────────────────────── */

/** Owner saat itu, atau pemegang `manage_signals` (AD-19 · O-06). */
export async function kelolaPelaksanaWorkAction(
  workId: number,
  userId: string,
  aksi: "tambah" | "lepas",
): Promise<HasilAksiWork> {
  const k = await konteks(workId);
  if (!k.ok) return k;
  if (k.user.id !== k.ownerId && !can(k.user, "manage_signals")) return { ok: false, pesan: DITOLAK };
  if (aksi !== "tambah" && aksi !== "lepas") return { ok: false, pesan: "Tindakan tidak dikenal." };

  const sasaran = bersihkan(userId);
  if (sasaran.length === 0) return { ok: false, pesan: "Pelaksana tidak dikenal." };

  const hasil = await kelolaPelaksanaWork(workId, sasaran, aksi, k.user.id);
  if (!hasil.ok) return { ok: false, pesan: pesanGagal(hasil.alasan) };
  segarkan();
  return { ok: true, berubah: hasil.hasil.berubah, id: workId };
}

/* ───────────────────────── E · ubah owner / departemen / tenggat ───────────────────────── */

export interface MasukanUbahWork {
  ownerId?: string | null;
  departemen?: string | null;
  tenggat?: string | null;
  alasan: string;
}

/**
 * Hanya pemegang `manage_signals` (O-08, O-09, O-11).
 *
 * Memindahkan tanggung jawab atas kehendak sendiri menghapus arti
 * accountability, jadi otoritasnya bukan Owner.
 */
export async function ubahWorkAction(workId: number, m: MasukanUbahWork): Promise<HasilAksiWork> {
  const k = await konteks(workId);
  if (!k.ok) return k;
  if (!can(k.user, "manage_signals")) return { ok: false, pesan: DITOLAK };

  const owner = m?.ownerId ? bersihkan(m.ownerId) : null;
  const departemen = m?.departemen ? bersihkan(m.departemen) : null;
  const tenggat = m?.tenggat ? bersihkan(m.tenggat) : null;
  const alasan = bersihkan(m?.alasan);

  if (owner === null && departemen === null && tenggat === null) {
    return { ok: false, pesan: "Tidak ada yang diubah." };
  }
  if (alasan.length === 0) return { ok: false, pesan: "Alasan wajib diisi." };
  if (tenggat !== null && Number.isNaN(Date.parse(tenggat))) return { ok: false, pesan: "Tenggat tidak sah." };

  const hasil = await ubahWork({ workId, owner, departemen, tenggat, alasan, oleh: k.user.id });
  if (!hasil.ok) return { ok: false, pesan: pesanGagal(hasil.alasan) };
  segarkan();
  return { ok: true, berubah: hasil.hasil.berubah, id: workId };
}

/* ───────────────────────────── F · ubah status ───────────────────────────── */

const STATUS_SAH = ["open", "in_progress", "completed", "cancelled"];

/**
 * Pindahkan status Work.
 *
 * ┌─ TIGA GERBANG YANG BERBEDA, DAN SUMBERNYA DISEBUT ───────────────────────┐
 * │                                                                          │
 * │   completed    HANYA Owner                       O-06 · I-23             │
 * │   cancelled    HANYA pemegang `manage_signals`   O-06                    │
 * │   in_progress  Owner, pelaksana aktif, atau `manage_signals`             │
 * │                                                                          │
 * │ Gerbang ketiga tidak terbaca dari tabel O-06 — tabel itu tidak pernah    │
 * │ menyebut siapa yang MEMULAI pekerjaan. Owner mengunci ketiganya pada     │
 * │ Z-02 Step 4: Owner, pelaksana aktif, atau `manage_signals`. Pelaksana    │
 * │ ikut karena O-05 mengeja `in_progress` sebagai "Executor sudah mulai     │
 * │ mengerjakan"; yang sudah dilepas tidak ikut, karena `work-baca.ts`       │
 * │ hanya menghitung yang `dilepas_pada IS NULL`.                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ YANG TIDAK DIPUTUSKAN DI SINI, DAN ITU DISENGAJA ───────────────────────┐
 * │                                                                          │
 * │ Berkas ini menjawab "boleh tidak orang ini MEMINTA perpindahan itu",     │
 * │ bukan "perpindahan itu sah atau tidak". Yang kedua milik mesin status    │
 * │ pada trigger (I-22), termasuk `open → completed` yang ditolak, terminal  │
 * │ yang berhenti (I-24), dan status yang sudah sama yang menjawab           │
 * │ `berubah: false` alih-alih galat (AD-20 · E).                            │
 * │                                                                          │
 * │ Menyalin salah satunya ke sini berarti dua mesin status untuk satu       │
 * │ perusahaan — dan yang kedua akan menyimpang diam-diam.                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export async function ubahStatusWorkAction(workId: number, status: string, alasan?: string): Promise<HasilAksiWork> {
  const k = await konteks(workId);
  if (!k.ok) return k;
  if (!STATUS_SAH.includes(status)) return { ok: false, pesan: "Status tidak dikenal." };

  const kelola = can(k.user, "manage_signals");
  const owner = k.user.id === k.ownerId;

  if (status === "completed" && !owner) return { ok: false, pesan: DITOLAK };
  if (status === "cancelled" && !kelola) return { ok: false, pesan: DITOLAK };
  // `open` memakai gerbang yang sama dengan `in_progress`: keduanya pertanyaan
  // "siapa yang menyentuh pekerjaan ini dari dekat". Sah atau tidaknya bukan
  // urusan gerbang — Work yang memang masih `open` dijawab `berubah: false`
  // (AD-20 · E), dan selain itu triggernya yang menolak.
  if ((status === "in_progress" || status === "open") && !owner && !kelola && !k.pelaksanaAktif) {
    return { ok: false, pesan: DITOLAK };
  }

  const bersih = bersihkan(alasan);
  if (status === "cancelled" && bersih.length === 0) return { ok: false, pesan: "Alasan wajib diisi." };

  const hasil = await ubahStatusWork(workId, status, bersih.length > 0 ? bersih : null, k.user.id);
  if (!hasil.ok) return { ok: false, pesan: pesanGagal(hasil.alasan) };
  segarkan();
  return { ok: true, berubah: hasil.hasil.berubah, id: workId };
}
