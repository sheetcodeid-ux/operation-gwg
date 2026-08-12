import type { Tone } from "@/lib/constants";

/**
 * Pengajuan antar-departemen.
 *
 * Tiga jenis, tiga alur persetujuan:
 *  • rekrutmen — permintaan pegawai. HC ACC → direkrut. Menyuplai KPI
 *    "Jumlah Rekrutmen" (target = jumlah yang diminta, realisasi = yang direkrut).
 *  • pelatihan — permintaan program pelatihan. HC ACC → Finance ACC dana →
 *    dilaksanakan. Menyuplai KPI "Development / Pelatihan".
 *  • design — permintaan materi desain ke tim Creative. Creative ACC →
 *    dikerjakan → selesai. Tidak melewati Finance.
 *
 * Ketiganya memakai satu mesin status yang sama; hanya labelnya yang
 * menyesuaikan jenis (lihat `statusMeta`).
 */

export type HcRequestKind = "rekrutmen" | "pelatihan" | "design";

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
