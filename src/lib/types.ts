/**
 * Operation GWG — Domain model
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
  | "assessor";

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
  code: string;
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
  | "instagram"
  | "whatsapp"
  | "email"
  | "walk_in";

export type ComplaintCategory =
  | "cleanliness"
  | "service"
  | "product_quality"
  | "price"
  | "facilities"
  | "staff_attitude"
  | "waiting_time"
  | "others";

export type ComplaintStatus =
  | "open"
  | "ongoing"
  | "pending"
  | "done"
  | "closed";

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
  /** Operation division the task belongs to. */
  division: Role;
  /** Branch is optional — null = division/HQ-level task (no branch). */
  outletId: string | null;
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
  priority: Priority;
  status: ComplaintStatus;
  rootCause?: RootCauseCategory | null;
  correctiveAction?: CorrectiveAction | null;
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
  | "score_drop";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  outletId?: string;
  areaId?: string;
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
