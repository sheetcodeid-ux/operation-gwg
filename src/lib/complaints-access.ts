import type { ComplaintCategory, UserProfile } from "./types";

/**
 * Siapa boleh apa pada satu komplain.
 *
 * Aturannya dikumpulkan di sini, bukan disebar sebagai perbandingan `role`
 * di halaman dan di server action masing-masing. Sebelumnya tersebar, dan
 * halaman bisa menampilkan tombol yang justru ditolak servernya — atau
 * sebaliknya, menyembunyikan tombol untuk orang yang sebenarnya berhak.
 *
 * Berkas ini sengaja bebas dari `server-only` supaya komponen klien memakai
 * aturan yang sama persis dengan yang ditegakkan server.
 */

/** Departemen yang menerima keluhan dari kanal publik (review, IG, TikTok). */
const INTAKE_DEPARTMENTS = ["Marketing Communication"];

/**
 * Boleh MEMASUKKAN komplain baru.
 *
 * Marketing Communication ikut karena merekalah pintu masuknya: keluhan dari
 * Google Review, Instagram, dan TikTok sampai ke mereka lebih dulu. Dicek lewat
 * departemen, bukan peran — akun mereka berperan `member`, dan menambahkan
 * `member` ke izin peran akan memberi akses yang sama kepada SELURUH anggota
 * divisi lain (Creative, Finance, dan seterusnya).
 */
export function canInputComplaint(user: Pick<UserProfile, "role" | "department"> | null): boolean {
  if (!user) return false;
  if (user.role === "super_admin" || user.role === "head_operation" || user.role === "admin_operation") return true;
  return INTAKE_DEPARTMENTS.includes(user.department ?? "");
}

/**
 * Boleh MENERUSKAN komplain ke supervisor — hanya Coordinator Area.
 *
 * Inilah langkah yang menentukan siapa yang bertanggung jawab memperbaiki.
 * Kalau siapa pun boleh meneruskan, tidak ada lagi satu orang yang memegang
 * gambaran beban kerja per cabang.
 */
export function canForwardComplaint(user: Pick<UserProfile, "role"> | null): boolean {
  return !!user && (user.role === "area_coordinator" || user.role === "super_admin");
}

/** Boleh MENGERJAKAN perbaikan dan mengirim hasilnya — supervisor cabang. */
export function canResolveComplaint(user: Pick<UserProfile, "role"> | null): boolean {
  return !!user && (user.role === "supervisor" || user.role === "super_admin");
}

/**
 * Boleh MENILAI hasil perbaikan — Coordinator Area yang sama.
 *
 * Sengaja bukan supervisor: orang yang diperiksa tidak boleh jadi penilai
 * hasilnya sendiri.
 */
export function canApproveComplaint(user: Pick<UserProfile, "role"> | null): boolean {
  return !!user && (user.role === "area_coordinator" || user.role === "super_admin");
}

/* ──────────────────────── cakupan kategori ──────────────────────── */

/**
 * Departemen yang hanya berkepentingan pada SEBAGIAN kategori komplain.
 *
 * Product Development & Quality bertanggung jawab atas mutu produk, jadi yang
 * relevan bagi mereka hanya keluhan rasa/mutu makanan. Keluhan soal keramahan
 * staf, kebersihan, atau sistem pembayaran bukan urusan mereka — dan komplain
 * memuat nama serta keluhan pelanggan, jadi membukanya lebih lebar dari
 * kebutuhan bukan sekadar berisik, tapi juga membagikan data yang tidak perlu.
 *
 * Memasukkan komplain TETAP milik Marketing Communication. PDQ hanya membaca:
 * tidak ada satu pun izin di berkas ini yang memberi peran PDQ hak meneruskan,
 * mengerjakan, atau menilai.
 */
const CATEGORY_SCOPE: Record<string, ComplaintCategory[]> = {
  "Product Development & Quality": ["food_quality"],
};

/**
 * Kategori komplain yang boleh dilihat seseorang.
 *
 * `null` berarti tanpa batas — itulah keadaan normal untuk Operation,
 * Coordinator Area, supervisor, dan admin.
 */
export function complaintCategoryScope(
  user: Pick<UserProfile, "role" | "department"> | null,
): ComplaintCategory[] | null {
  if (!user) return null;
  // Admin tidak pernah dibatasi — ia mengurus seluruh aplikasi.
  if (user.role === "super_admin") return null;
  return CATEGORY_SCOPE[user.department ?? ""] ?? null;
}

/** Apakah satu komplain masuk cakupan kategori orang ini. */
export function canSeeComplaintCategory(
  user: Pick<UserProfile, "role" | "department"> | null,
  category: ComplaintCategory,
): boolean {
  const scope = complaintCategoryScope(user);
  return scope === null || scope.includes(category);
}

/* ─────────────────────────── tahapan ─────────────────────────── */

/**
 * Posisi sebuah komplain dalam alurnya.
 *
 * Diturunkan dari data, bukan disimpan sebagai kolom sendiri — satu-satunya
 * sumber kebenarannya tetap `assignment`, `approval`, dan `status`, sehingga
 * tidak mungkin ada tahap yang bertentangan dengan isinya.
 */
export type ComplaintStage = "baru" | "dikerjakan" | "verifikasi" | "selesai";

export interface StageInput {
  status: string;
  assignment?: { assignedTo: string } | null;
  approval?: { stage: string } | null;
}

export function complaintStage(c: StageInput): ComplaintStage {
  if (c.status === "close") return "selesai";
  if (c.approval?.stage === "pending") return "verifikasi";
  if (c.assignment?.assignedTo) return "dikerjakan";
  return "baru";
}

export const COMPLAINT_STAGE = {
  baru: {
    label: "Belum diteruskan",
    hint: "Menunggu Coordinator Area meneruskan ke supervisor cabang.",
    tone: "red" as const,
  },
  dikerjakan: {
    label: "Sedang ditangani",
    hint: "Sudah diteruskan; supervisor mengerjakan perbaikannya.",
    tone: "amber" as const,
  },
  verifikasi: {
    label: "Menunggu verifikasi",
    hint: "Supervisor sudah mengirim hasil; menunggu penilaian Coordinator Area.",
    tone: "blue" as const,
  },
  selesai: {
    label: "Selesai",
    hint: "Perbaikan sudah diterima Coordinator Area.",
    tone: "emerald" as const,
  },
};
