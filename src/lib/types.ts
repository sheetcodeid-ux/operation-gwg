/**
 * Operational System — Domain model
 * Single source of truth for entity shapes shared across the data layer,
 * server actions, and UI. Designed to map 1:1 onto the Supabase schema
 * delivered in Phase 11.
 */

/* ------------------------------------------------------------------ */
/* Identity & RBAC                                                     */
/* ------------------------------------------------------------------ */

export type Role =
  // Operation division
  | "super_admin"
  | "head_operation"
  | "area_coordinator"
  | "data_operation"
  | "pos_operation"
  | "admin_operation"
  // Supervisor division
  | "supervisor"
  // R&D division
  | "head_bar_rnd"
  | "bar_rnd"
  | "kitchen_rnd"
  | "coordinator_rnd"
  // HRD division
  | "legal"
  // Assessment-only evaluator (division Head acting as Atasan Langsung)
  | "assessor"
  // Generic division member — access comes from their `department` (e.g. a
  // Creative/Finance staff who only opens their division's Work Tracker).
  | "member";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Area this user coordinates (area_coordinator). */
  areaId?: string | null;
  /** Assigned outlets/branches. Optional — HQ roles (super_admin, data_operation, admin_operation) have none. */
  outletIds?: string[];
  avatarUrl?: string | null;
  /** Optional contact details (User Management). */
  phone?: string | null;
  country?: string | null;
  /** Org department (Finance Accounting Tax, Creative Director, …) — decoupled
   *  from `role`, which drives menu access. */
  department?: string | null;
  /** Job title / sub-team within the department (Treasury, Tax, Driver, …). */
  jabatan?: string | null;
  /** Extra per-user menu grants beyond the role, as "<Division>:<menuKey>". */
  grants?: string[];
  active: boolean;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Organization                                                        */
/* ------------------------------------------------------------------ */

export interface Area {
  id: string;
  name: string;
  code: string;
  /** Area Coordinator user id. */
  coordinatorId: string;
}

export interface Outlet {
  id: string;
  name: string;
  /** Kode POS. TIDAK sama dengan id cabang ESB — lihat `esbBranchId`. */
  code: string;
  /**
   * Id cabang di ESB, mis. "18-fnb_nord".
   *
   * Berdiri sendiri karena `code` menyimpan kode POS untuk 49 dari 58 outlet,
   * dan hanya 9 yang kebetulan berisi id ESB. Menggabungkan keduanya membuat
   * penjualan per outlet diam-diam kosong untuk sebagian besar cabang — persis
   * yang terjadi pada tabel Efisiensi Beban Operasional.
   */
  esbBranchId?: string | null;
  /**
   * Penjualannya diisi tangan karena riwayatnya tidak ada di ESB.
   *
   * Tiga outlet pindah dari POS Majoo dan riwayatnya tidak ikut terbawa.
   * Ditandai apa adanya, bukan ditebak dari keadaan datanya — tebakan ikut
   * menyeret outlet lain yang kebetulan juga belum genap tiga bulan, dan
   * daftarnya berubah-ubah tiap kali bulannya diganti.
   */
  grossManual?: boolean;
  city: string;
  areaId: string;
  supervisorId: string;
  picId: string;
  active: boolean;
}

/* ------------------------------------------------------------------ */
/* Shared enums                                                        */
/* ------------------------------------------------------------------ */

export type Priority = "critical" | "high" | "medium" | "low";

export type TaskStatus = "open" | "ongoing" | "pending" | "done" | "cancelled";

export type EventStatus = "upcoming" | "running" | "finished" | "cancelled";

export type EventMilestone =
  | "planning"
  | "preparation"
  | "execution"
  | "evaluation";

export type HygieneRating = "excellent" | "good" | "fair" | "poor";

export type ComplaintSource =
  | "google_review"
  | "customer_service"
  | "grup_kuning"
  | "instagram"
  | "tiktok";

export type ComplaintCategory =
  | "service"
  | "food_quality"
  | "cleanliness"
  | "staff_characteristics"
  | "price"
  | "payment_system"
  | "ambiance"
  | "order_error";

export type ComplaintStatus = "open" | "in_progress" | "close";

export type RootCauseCategory =
  | "man"
  | "method"
  | "material"
  | "machine"
  | "environment";

/* ------------------------------------------------------------------ */
/* Module 2 — Hospitality Assessment                                   */
/* ------------------------------------------------------------------ */

export type HospitalityCategory = "cashier" | "fnb" | "dining_area";

export interface HospitalityAssessment {
  id: string;
  outletId: string;
  areaId: string;
  assessorId: string;
  staffName: string;
  staffPosition: string;
  date: string;
  /** category -> checklist item key -> score 1..5 */
  scores: Record<HospitalityCategory, Record<string, number>>;
  notes?: string;
  /** 0..100 derived */
  overallScore: number;
}

/* ------------------------------------------------------------------ */
/* Module 3 — Work Tracker                                             */
/* ------------------------------------------------------------------ */

export interface Attachment {
  id: string;
  name: string;
  url: string;
  kind: "photo" | "pdf" | "excel" | "document";
  size?: number;
}

export interface WorkTask {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  /** Department/division the task belongs to (Finance, Creative, …). */
  division: string;
  /** Branch is optional — null = division/HQ-level task (no branch). */
  outletId: string | null;
  /**
   * Cabang yang tersentuh tugas ini. Satu kerjaan yang berdampak ke banyak
   * cabang tetap SATU tugas — sebelumnya tiap cabang dibuatkan barisnya sendiri,
   * sehingga satu pekerjaan marketing muncul puluhan kali di Work Tracker.
   * `outletId` dipertahankan sebagai cabang pertama untuk data lama.
   */
  outletIds: string[];
  /** Brand yang tersentuh: Nordu, Cattu, Busari, Lesung Pipi. */
  brands: string[];
  areaId: string | null;
  /** Assigned people (PIC) — manually picked from the division's members; can be 1 or many. */
  picIds: string[];
  /** Legacy single PIC = picIds[0] (kept for back-compat). */
  picId: string | null;
  startDate: string;
  dueDate: string;
  completionDate?: string | null;
  progress: number; // 0..100
  attachments: Attachment[];
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Module 4 — Event Tracker                                            */
/* ------------------------------------------------------------------ */

export interface OpsEvent {
  id: string;
  name: string;
  outletId: string;
  areaId: string;
  picId: string;
  description: string;
  budget: number;
  startDate: string;
  endDate: string;
  milestone: EventMilestone;
  status: EventStatus;
  progress: number; // 0..100 derived from milestone
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Module 5 — Hygiene Monitoring                                       */
/* ------------------------------------------------------------------ */

export type HygieneSection = "front" | "customer" | "cashier" | "kitchen" | "toilet" | "warehouse";

export interface HygieneAudit {
  id: string;
  outletId: string;
  areaId: string;
  date: string;
  shift: string;
  inspectorName: string;
  supervisorName: string;
  /** section -> item key -> rating */
  ratings: Record<HygieneSection, Record<string, HygieneRating>>;
  findings: string[];
  photos: Attachment[];
  isClean: boolean;
  /** 0..100 derived */
  hygieneScore: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Module 6 — Complaint Management                                     */
/* ------------------------------------------------------------------ */

export interface CorrectiveAction {
  actionDate: string;
  picId: string;
  description: string;
  followUpDate?: string | null;
}

/** Approval stage after a resolution is submitted. The admin who resolves the
 *  complaint sends it to the Coordinator Area, who approves it (optionally with
 *  a photo + note) to mark it done. */
export type ComplaintApprovalStage = "pending" | "approved";

export interface ComplaintApproval {
  stage: ComplaintApprovalStage;
  /** admin who submitted the resolution for approval */
  submittedById: string;
  submittedAt: string;
  /** Coordinator Area who approved (set once approved) */
  approverId?: string | null;
  approverName?: string | null;
  approvedAt?: string | null;
  /** optional explanation from the approver */
  note?: string | null;
  /** optional supporting photo (public URL) */
  photoUrl?: string | null;
}

/**
 * Penerusan komplain dari Coordinator Area ke supervisor cabang.
 *
 * Langkah ini yang menetapkan SIAPA bertanggung jawab memperbaiki. Tanpa
 * penerusan, komplain hanya "terlihat" oleh supervisor yang kebetulan memegang
 * outletnya — dan tidak ada yang benar-benar merasa ditugaskan.
 */
export interface ComplaintAssignment {
  /** Supervisor yang ditugaskan. */
  assignedTo: string;
  assignedToName: string;
  /** Coordinator Area yang meneruskan. */
  assignedBy: string;
  assignedByName: string;
  assignedAt: string;
  /** Arahan dari Coordinator Area — apa yang perlu diperbaiki. */
  note: string;
}

export interface Complaint {
  id: string;
  source: ComplaintSource;
  customerName: string;
  /** present for google_review */
  rating?: number | null;
  content: string;
  reviewDate: string;
  outletId: string;
  areaId: string;
  category: ComplaintCategory;
  status: ComplaintStatus;
  rootCause?: RootCauseCategory | null;
  correctiveAction?: CorrectiveAction | null;
  approval?: ComplaintApproval | null;
  /** Diisi saat Coordinator Area meneruskannya ke supervisor. */
  assignment?: ComplaintAssignment | null;
  createdAt: string;
  closedAt?: string | null;
}

/* ------------------------------------------------------------------ */
/* Notifications & Audit                                               */
/* ------------------------------------------------------------------ */

export type NotificationKind =
  | "hygiene_overdue"
  | "complaint_overdue"
  | "task_overdue"
  | "event_deadline"
  | "score_drop"
  | "hpp_review"
  | "hc_done"
  | "sys_update"
  | "elearning"
  // Aktivitas pengajuan — tiap perubahan status punya jenisnya sendiri supaya
  // ikonnya bisa berbeda dan penyaringan per jenis tetap mungkin nanti.
  | "request_new"
  | "request_approved"
  | "request_assigned"
  | "request_revision"
  | "request_done"
  | "request_rejected"
  // Pesan masuk. SELALU perorangan — isi percakapan tidak pernah boleh sampai
  // ke seluruh departemen.
  | "chat_message"
  // Pengingat Update Bulanan outlet (HC-MOS Kontrak Tracker).
  | "hc_update_due"
  // Laporan penilaian permintaan design yang dikirim ke Coordinator Area.
  | "creative_report"
  // Aktivitas komplain.
  | "complaint_new"
  | "complaint_forwarded"
  | "complaint_resolved";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  outletId?: string;
  areaId?: string;
  /** Ditujukan ke SATU orang. Kosong berarti penerimanya bukan perorangan. */
  targetUser?: string;
  /**
   * Ditujukan ke seluruh anggota satu DEPARTEMEN.
   *
   * Inilah yang membuat aktivitas tim tidak tercampur: pengajuan design masuk
   * ke notifikasi Creative saja, komplain baru ke Operation saja. Tanpa ini,
   * satu-satunya penerima yang mungkin adalah perorangan atau semua pemilik
   * outlet — dan aktivitas tim tidak cocok pada keduanya.
   */
  department?: string;
  /**
   * Halaman tujuan saat diklik.
   *
   * Tanpa ini notifikasi hanya bisa dibaca, tidak bisa ditindaklanjuti — orang
   * harus mencari sendiri pengajuan mana yang dimaksud.
   */
  href?: string;
  /** Nama pelaku, untuk baris "oleh siapa". */
  actorName?: string;
  /** Disingkirkan pengguna lewat tombol ×. Beda dari `read` (sekadar dilihat). */
  dismissed?: boolean;
  severity: "info" | "warning" | "critical";
  read: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  at: string;
}
