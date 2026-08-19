import type { Tone } from "@/lib/constants";

/**
 * Pengajuan antar-departemen.
 *
 * Tiga jenis, tiga alur persetujuan:
 *  • rekrutmen — permintaan pegawai. HC ACC → direkrut.
 *  • pelatihan — permintaan program pelatihan. HC ACC → Finance ACC dana →
 *    dilaksanakan.
 *  • design — permintaan materi desain ke tim Creative. Creative ACC →
 *    dikerjakan → selesai. Tidak melewati Finance.
 *
 * Ketiganya memakai satu mesin status yang sama; hanya labelnya yang
 * menyesuaikan jenis (lihat `statusMeta`).
 */

export type HcRequestKind = "rekrutmen" | "pelatihan" | "design";

/* ─────────────────────── scope permintaan karyawan ───────────────────────
 * Hasil Meeting Fitur HRD: permintaan karyawan dipisah Manajemen dan Outlet.
 *
 * Pemisahnya bukan label. Keduanya ditangani orang yang berbeda dan diukur
 * dengan cara yang berbeda: permintaan divisi biasanya satu orang untuk satu
 * posisi dan lamanya dihitung dari kebutuhan divisinya, sementara permintaan
 * cabang datang berulang, jumlahnya banyak, dan waktunya diukur terhadap
 * jadwal buka cabang. Dicampur, rata-rata waktu rekrutmen berhenti berarti
 * bagi keduanya.                                                            */

export const SCOPE_MANPOWER = ["manajemen", "outlet"] as const;
export type ScopeManpower = (typeof SCOPE_MANPOWER)[number];

export const LABEL_SCOPE_MANPOWER: Record<ScopeManpower, string> = {
  manajemen: "Manajemen (Divisi)",
  outlet: "Outlet",
};

export const PENJELASAN_SCOPE_MANPOWER: Record<ScopeManpower, string> = {
  manajemen: "Permintaan dari divisi kantor pusat.",
  outlet: "Permintaan dari cabang — diajukan Supervisor outlet yang bersangkutan.",
};

export function scopeManpowerValid(v: string): v is ScopeManpower {
  return (SCOPE_MANPOWER as readonly string[]).includes(v);
}

/**
 * Scope bawaan untuk seorang pemohon.
 *
 * Supervisor memegang satu cabang dan tidak membawahi divisi mana pun, jadi
 * permintaannya selalu permintaan outlet. Menyodorkan pilihan "Manajemen"
 * sebagai bawaan kepadanya hanya mengundang salah pilih pada formulir yang ia
 * isi berulang kali.
 */
export function scopeBawaan(role: string | null | undefined): ScopeManpower {
  return role === "supervisor" ? "outlet" : "manajemen";
}

/* ───────────────────────────── batas unggah ─────────────────────────────
 * Satu sumber untuk pemohon MAUPUN tim yang mengerjakan. Sebelumnya angkanya
 * ditulis ulang di lima tempat — server, penyandang tanda tangan unggahan,
 * pemilih berkas, dan dua teks petunjuk — sehingga menaikkan batas di satu
 * tempat menyisakan penolakan di tempat lain.                              */

/** Ukuran maksimal SATU berkas lampiran pengajuan. */
export const UPLOAD_MAX_MB = 100;
export const UPLOAD_MAX_BYTES = UPLOAD_MAX_MB * 1024 * 1024;
/** Banyaknya berkas yang boleh dilampirkan sekali kirim. */
export const UPLOAD_MAX_FILES = 20;
/** Teks petunjuk di bawah pemilih berkas — dipakai semua formulir. */
export const UPLOAD_HINT = `PDF / JPG / PNG, maks ${UPLOAD_MAX_MB} MB per berkas, hingga ${UPLOAD_MAX_FILES} berkas.`;

/**
 * Ambang aman untuk melewati server action.
 *
 * Badan permintaan menuju fungsi serverless dibatasi beberapa MB dan ditolak
 * di lapisan platform — sebelum kode kita sempat jalan — sehingga yang
 * terlihat pengguna hanyalah "an unexpected response was received from the
 * server". Berkas di atas ambang ini WAJIB naik langsung ke R2.
 */
export const DIRECT_UPLOAD_MIN = 3 * 1024 * 1024;

/** Satu putaran revisi yang diminta pemohon atas hasil design. */
export interface HcRequestRevision {
  at: string;
  byName: string;
  note: string;
}

/** Penugasan design: siapa yang mengerjakan, dan tugas Work Tracker-nya. */
export interface HcRequestAssignment {
  assigneeId: string | null;
  assigneeName: string | null;
  workTaskId: string | null;
  /** Riwayat revisi — kosong berarti belum pernah direvisi. */
  revisions: HcRequestRevision[];
}

export type HcRequestStatus =
  | "menunggu_hc"
  | "ditolak_hc"
  | "disetujui_hc"
  | "menunggu_finance"
  | "ditolak_finance"
  | "disetujui_finance"
  | "terlaksana";

export const HC_REQUEST_KIND_LABEL: Record<HcRequestKind, string> = {
  rekrutmen: "Permintaan Karyawan",
  pelatihan: "Pengajuan Pelatihan",
  design: "Pengajuan Design",
};

/** Tim yang meninjau tiap jenis pengajuan (dipakai di label status & alur). */
export const REVIEWER_LABEL: Record<HcRequestKind, string> = {
  rekrutmen: "Human Capital",
  pelatihan: "Human Capital",
  design: "Creative",
};

/**
 * Departemen yang menangani tiap jenis pengajuan — penerima notifikasinya.
 *
 * Nilainya harus SAMA PERSIS dengan `users.department`, karena itulah yang
 * dicocokkan saat menentukan notifikasi siapa. Nama yang meleset satu huruf
 * membuat notifikasinya tersimpan tapi tidak pernah sampai ke siapa pun.
 */
export const REVIEWER_DEPARTMENT: Record<HcRequestKind, string> = {
  rekrutmen: "Human Capital",
  pelatihan: "Human Capital",
  design: "Creative",
};

/** Halaman antrean tim peninjau — tujuan notifikasi untuk mereka. */
export const REVIEWER_HREF: Record<HcRequestKind, string> = {
  rekrutmen: "/hc/permintaan",
  pelatihan: "/hc/pelatihan",
  design: "/creative/design",
};

/** Halaman pemohon — tujuan notifikasi tentang pengajuannya sendiri. */
export const REQUESTER_HREF = "/pengajuan";

export const HC_REQUEST_STATUS_META: Record<HcRequestStatus, { label: string; tone: Tone }> = {
  menunggu_hc: { label: "Menunggu ACC HC", tone: "warning" },
  ditolak_hc: { label: "Ditolak HC", tone: "danger" },
  disetujui_hc: { label: "Disetujui HC", tone: "cyan" },
  menunggu_finance: { label: "Menunggu ACC Finance", tone: "amber" },
  ditolak_finance: { label: "Ditolak Finance", tone: "danger" },
  disetujui_finance: { label: "Dana Disetujui", tone: "brand" },
  terlaksana: { label: "Terlaksana", tone: "success" },
};

/** Label status yang menyesuaikan jenis pengajuan (desain tidak lewat HC/Finance). */
export function statusMeta(kind: HcRequestKind, status: HcRequestStatus): { label: string; tone: Tone } {
  if (kind !== "design") {
    if (status === "terlaksana" && kind === "rekrutmen") return { label: "Terpenuhi", tone: "success" };
    return HC_REQUEST_STATUS_META[status];
  }
  switch (status) {
    case "menunggu_hc":
      return { label: "Menunggu Creative", tone: "warning" };
    case "ditolak_hc":
      return { label: "Ditolak Creative", tone: "danger" };
    case "disetujui_hc":
      return { label: "Sedang Dikerjakan", tone: "cyan" };
    case "terlaksana":
      return { label: "Selesai", tone: "success" };
    default:
      return HC_REQUEST_STATUS_META[status];
  }
}

/** Jenis pelatihan yang bisa dipilih (bebas ditambah lewat "Lainnya"). */
export const TRAINING_TYPES = [
  "Onboarding / Orientasi",
  "Product Knowledge",
  "Service Excellence",
  "Leadership & Supervisi",
  "Barista / Kitchen Skill",
  "Hygiene & Food Safety",
  "Administrasi & Sistem",
  "Lainnya",
];

/** Jenis materi desain — disamakan dengan kategori kerja tim Creative. */
export const DESIGN_TYPES = [
  "Instagram Post",
  "Instagram Story",
  "Instagram Reels",
  "Poster / Print Out",
  "Banner / Spanduk",
  "Menu / Daftar Harga",
  "Logo & Branding",
  "Gojek / Website",
  "Lainnya",
];

export interface HcRequestAttachment {
  path?: string;
  name: string;
  url?: string;
}

export interface HcRequest {
  id: string;
  kind: HcRequestKind;
  department: string;
  requesterId: string;
  requesterName: string;
  title: string;
  description: string;
  /** Nama orang yang dituju pengajuan ini (peserta, penerima desain, dsb). */
  subjectName: string;
  /** rekrutmen */
  position: string | null;
  headcount: number;
  /** Manajemen (divisi) atau Outlet — khusus permintaan karyawan. */
  scope: ScopeManpower;
  /** Outlet yang meminta; kosong untuk scope Manajemen. */
  outletId: string | null;
  outletName: string | null;
  recruited: number;
  /** pelatihan */
  trainingType: string | null;
  participants: number;
  /** Nama peserta yang dipilih dari anggota departemen pemohon. */
  participantNames: string[];
  budget: number;
  budgetApproved: number;
  /** design */
  designType: string | null;
  designSize: string | null;
  /** Rencana pelaksanaan (pelatihan) / target mulai (rekrutmen) / deadline (design). */
  plannedDate: string | null;
  attachments: HcRequestAttachment[];
  status: HcRequestStatus;
  hcNote: string;
  financeNote: string;
  hcByName: string | null;
  financeByName: string | null;
  /** Design: PIC yang mengerjakan + tugas Work Tracker yang terbentuk. */
  assigneeId: string | null;
  assigneeName: string | null;
  workTaskId: string | null;
  /** Riwayat revisi — kosong berarti belum pernah direvisi. */
  revisions: HcRequestRevision[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/* ─────────────────────── tahapan & saringan antrian ───────────────────────
 * Setiap antrian (Design, Dokumen HC, Sistem) dulu menyusun daftar statusnya
 * sendiri, sehingga "Selesai" di satu halaman tidak berarti sama dengan
 * "Selesai" di halaman lain. Tahapannya kini DITURUNKAN dari data — bukan
 * kolom tersendiri — jadi tidak mungkin ada tahap yang bertentangan dengan
 * isi pengajuannya.                                                        */

export type RequestStage = "menunggu" | "dikerjakan" | "revisi" | "selesai" | "ditolak";

export interface StageInput {
  kind: HcRequestKind;
  status: HcRequestStatus;
  /** Riwayat revisi — hanya terisi pada pengajuan design. */
  revisions?: { at: string }[];
}

/**
 * Posisi sebuah pengajuan dalam alurnya.
 *
 * Khusus design, "sedang dikerjakan" dan "sedang direvisi" memakai status yang
 * SAMA (`disetujui_hc`): meminta revisi mengembalikan design yang sudah
 * terkirim ke status itu lagi. Yang membedakan hanyalah ada tidaknya riwayat
 * revisi — dan itu memang pembeda yang benar, karena design yang pernah
 * direvisi bukan pekerjaan baru.
 */
export function requestStage(r: StageInput): RequestStage {
  if (r.status === "ditolak_hc" || r.status === "ditolak_finance") return "ditolak";
  if (r.status === "terlaksana") return "selesai";
  if (r.status === "menunggu_hc") return "menunggu";
  if (r.kind === "design" && r.status === "disetujui_hc" && (r.revisions?.length ?? 0) > 0) return "revisi";
  return "dikerjakan";
}

/**
 * Pilihan saringan untuk satu jenis pengajuan.
 *
 * Design punya tahap "Revisi" yang nyata dan sering; jenis lain tidak
 * mengenalnya, jadi menampilkannya di sana hanya jadi tombol yang selalu nol.
 * "Ditolak" selalu ikut supaya pengajuan yang ditolak tidak lenyap dari
 * pandangan — satu-satunya tempatnya dulu hanyalah "Semua".
 */
export function stageFilters(kind: HcRequestKind): { value: RequestStage | "all"; label: string }[] {
  const dikerjakan = kind === "design" ? "Sedang Dikerjakan" : "Diproses";
  return [
    { value: "all", label: "Semua" },
    { value: "menunggu", label: "Menunggu" },
    { value: "dikerjakan", label: dikerjakan },
    ...(kind === "design" ? ([{ value: "revisi", label: "Revisi" }] as const) : []),
    { value: "selesai", label: "Selesai" },
    { value: "ditolak", label: "Ditolak" },
  ];
}

/** Langkah berikutnya yang wajar untuk sebuah pengajuan (dipakai tombol aksi). */
export function nextActions(r: HcRequest): { hc: boolean; finance: boolean; complete: boolean } {
  if (r.kind === "pelatihan") {
    return {
      hc: r.status === "menunggu_hc",
      finance: r.status === "menunggu_finance",
      complete: r.status === "disetujui_finance",
    };
  }
  // Rekrutmen & design: satu kali persetujuan, lalu ditutup saat selesai.
  return { hc: r.status === "menunggu_hc", finance: false, complete: r.status === "disetujui_hc" };
}

/* ─────────────────── siapa melihat pekerjaan siapa (design) ───────────────────
 *
 * Antrian Design dipakai beberapa designer sekaligus. Sebelumnya semuanya
 * melihat SELURUH antrian, sehingga Seka membuka "Sedang Dikerjakan" dan yang
 * muncul adalah pekerjaan Via — tidak ada cara membedakan mana kerjaannya
 * sendiri selain mengingat satu per satu.
 *
 * Pemisahnya PENUGASAN, bukan tahapnya:
 *
 *   belum ditugaskan → kolam bersama, terlihat semua orang. Inilah yang
 *                      biasanya mengisi "Menunggu": permintaan yang baru masuk
 *                      dan belum jelas siapa yang mengambil.
 *   sudah ditugaskan → milik PIC-nya saja, di tahap mana pun ia berada —
 *                      dikerjakan, revisi, selesai, maupun ditolak.
 *
 * Memakai tahap sebagai pemisah ("Menunggu bersama, sisanya pribadi") terdengar
 * mirip tapi salah: pengajuan yang sudah ditugaskan lalu dikembalikan ke
 * Menunggu akan muncul lagi di layar semua orang, dan pengajuan yang belum
 * ditugaskan tapi sudah disetujui akan hilang dari semua orang — termasuk dari
 * yang seharusnya mengambilnya.
 */

/**
 * Jabatan yang mengelola antrian, bukan mengerjakannya.
 *
 * Mereka menugaskan PIC, jadi mereka harus melihat seluruh antrian — termasuk
 * pekerjaan yang sudah dipegang orang lain, karena itulah dasar membagi beban.
 */
const JABATAN_PENGELOLA = ["head", "manager", "supervisor", "kepala", "koordinator", "coordinator", "lead"];

/** Apakah pengguna ini mengelola antrian design (melihat semua + menugaskan)? */
export function kelolaAntrianDesign(
  user: { role?: string | null; jabatan?: string | null } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  // Dicocokkan per KATA supaya "Graphic Designer" tidak ikut hanya karena
  // mengandung potongan huruf yang sama dengan salah satu jabatan pengelola.
  const kata = (user.jabatan ?? "").toLowerCase().split(/[^a-z]+/).filter(Boolean);
  return kata.some((k) => JABATAN_PENGELOLA.includes(k));
}

/** Bentuk seminimal mungkin yang cukup untuk menentukan kepemilikan satu baris. */
export interface BarisAntrian {
  kind: HcRequestKind;
  status: HcRequestStatus;
  assigneeId?: string | null;
  revisions?: { at: string }[];
}

/**
 * Antrian yang pantas dilihat seorang designer.
 *
 * Menunggu adalah PAPAN PENGUMUMAN: permintaan yang baru masuk belum jadi
 * pekerjaan siapa pun, dan seluruh tim perlu melihatnya untuk tahu apa yang
 * akan datang. Begitu keluar dari Menunggu, ia sudah jadi pekerjaan seseorang —
 * dan sejak itu hanya orang itu yang perlu melihatnya.
 *
 * Perhatikan bahwa pemisahnya TAHAP, bukan sekadar ada tidaknya PIC. Keduanya
 * hampir selalu sama, tapi tidak pada satu kasus yang justru paling merepotkan:
 * pengajuan yang disetujui tanpa ditugaskan ke siapa pun. Memakai "belum ada
 * PIC" sebagai penanda kolam bersama membuat baris seperti itu nongol di layar
 * SEMUA orang, di tab "Sedang Dikerjakan" — padahal tidak ada yang mengerjakan,
 * dan tidak seorang pun bisa memastikan itu bukan bagiannya.
 *
 * Baris tanpa PIC di luar Menunggu tetap terlihat oleh yang mengelola antrian,
 * yang memang tugasnya membagikannya.
 */
export function antrianUntukPic<T extends BarisAntrian>(rows: T[], userId: string): T[] {
  return rows.filter((r) => requestStage(r) === "menunggu" || r.assigneeId === userId);
}

export const isOpen = (s: HcRequestStatus) => s !== "terlaksana" && s !== "ditolak_hc" && s !== "ditolak_finance";

export const fmtRupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

/* ───────────────────────────── alur persetujuan ───────────────────────────── */

export type StepState = "done" | "current" | "todo" | "rejected";

export interface RequestStep {
  label: string;
  state: StepState;
  /** Baris kecil di bawah label: penanggung jawab / hasil langkah. */
  detail?: string;
}

/**
 * Alur satu pengajuan sebagai deretan langkah — dipakai stepper di UI supaya
 * pemohon selalu tahu posisi berkasnya, bukan sekadar satu label status.
 */
export function requestSteps(r: HcRequest): RequestStep[] {
  const afterReview: HcRequestStatus[] = ["disetujui_hc", "menunggu_finance", "ditolak_finance", "disetujui_finance", "terlaksana"];
  const reviewState: StepState =
    r.status === "ditolak_hc" ? "rejected" : afterReview.includes(r.status) ? "done" : "current";

  const steps: RequestStep[] = [
    { label: "Diajukan", state: "done", detail: r.requesterName },
    { label: `Persetujuan ${REVIEWER_LABEL[r.kind]}`, state: reviewState, detail: r.hcByName ?? undefined },
  ];

  if (r.kind === "pelatihan") {
    const financeState: StepState =
      r.status === "ditolak_finance"
        ? "rejected"
        : r.status === "disetujui_finance" || r.status === "terlaksana"
          ? "done"
          : r.status === "menunggu_finance"
            ? "current"
            : "todo";
    steps.push({
      label: "Dana Finance",
      state: financeState,
      detail: r.budgetApproved > 0 ? fmtRupiah(r.budgetApproved) : (r.financeByName ?? undefined),
    });
  }

  const readyToRun = r.kind === "pelatihan" ? r.status === "disetujui_finance" : r.status === "disetujui_hc";
  const lastLabel =
    r.kind === "rekrutmen" ? "Pegawai Diterima" : r.kind === "design" ? "Design Selesai" : "Pelatihan Terlaksana";
  steps.push({
    label: lastLabel,
    state: r.status === "terlaksana" ? "done" : readyToRun ? "current" : "todo",
    detail:
      r.status === "terlaksana" && r.kind === "rekrutmen" ? `${r.recruited} dari ${r.headcount} orang` : undefined,
  });

  return steps;
}
