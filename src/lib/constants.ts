import type {
  ComplaintCategory,
  ComplaintSource,
  ComplaintStatus,
  EventMilestone,
  EventStatus,
  HospitalityCategory,
  HygieneRating,
  HygieneSection,
  Priority,
  Role,
  RootCauseCategory,
  TaskStatus,
} from "./types";

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  head_operation: "Head Operation",
  area_coordinator: "Coordinator Area",
  data_operation: "Data Operation",
  pos_operation: "POS Operation",
  admin_operation: "Admin Operation",
  supervisor: "Supervisor",
  head_bar_rnd: "Head Bar R&D",
  bar_rnd: "Bar R&D",
  kitchen_rnd: "Kitchen R&D",
  coordinator_rnd: "Coordinator R&D",
  legal: "Legal",
  assessor: "Penilai Assessment",
  member: "Anggota Divisi",
};

/* ------------------------------------------------------------------ */
/* Tone system — drives badge/label coloring across the app           */
/* ------------------------------------------------------------------ */

export type Tone = "brand" | "cyan" | "amber" | "success" | "warning" | "danger" | "neutral";

export const PRIORITY_META: Record<Priority, { label: string; tone: Tone }> = {
  critical: { label: "Critical", tone: "danger" },
  high: { label: "High", tone: "warning" },
  medium: { label: "Medium", tone: "cyan" },
  low: { label: "Low", tone: "neutral" },
};

export const TASK_STATUS_META: Record<TaskStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "neutral" },
  ongoing: { label: "Ongoing", tone: "cyan" },
  pending: { label: "Pending", tone: "warning" },
  done: { label: "Done", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const EVENT_STATUS_META: Record<EventStatus, { label: string; tone: Tone }> = {
  upcoming: { label: "Upcoming", tone: "cyan" },
  running: { label: "Running", tone: "brand" },
  finished: { label: "Finished", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const EVENT_MILESTONES: { value: EventMilestone; label: string; progress: number }[] = [
  { value: "planning", label: "Planning", progress: 25 },
  { value: "preparation", label: "Preparation", progress: 50 },
  { value: "execution", label: "Execution", progress: 75 },
  { value: "evaluation", label: "Evaluation", progress: 100 },
];

export const HYGIENE_RATING_META: Record<HygieneRating, { label: string; tone: Tone; score: number }> = {
  excellent: { label: "Sangat Baik", tone: "success", score: 100 },
  good: { label: "Baik", tone: "cyan", score: 80 },
  fair: { label: "Cukup", tone: "warning", score: 55 },
  poor: { label: "Kurang", tone: "danger", score: 25 },
};

export const COMPLAINT_SOURCE_META: Record<ComplaintSource, { label: string; tone: Tone }> = {
  google_review: { label: "Google Review", tone: "amber" },
  customer_service: { label: "Customer Service", tone: "cyan" },
  grup_kuning: { label: "Grup Kuning", tone: "success" },
  instagram: { label: "Instagram", tone: "brand" },
  tiktok: { label: "TikTok", tone: "neutral" },
};

export const COMPLAINT_CATEGORY_META: Record<ComplaintCategory, { label: string }> = {
  service: { label: "Service" },
  food_quality: { label: "Food Quality" },
  cleanliness: { label: "Cleanliness" },
  staff_characteristics: { label: "Staff Characteristics" },
  price: { label: "Price" },
  payment_system: { label: "Payment System" },
  ambiance: { label: "Ambiance" },
  order_error: { label: "Order Error" },
};

export const COMPLAINT_STATUS_META: Record<ComplaintStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "warning" },
  in_progress: { label: "In Progress", tone: "cyan" },
  close: { label: "Close", tone: "success" },
};

export const ROOT_CAUSE_META: Record<RootCauseCategory, { label: string }> = {
  man: { label: "Man" },
  method: { label: "Method" },
  material: { label: "Material" },
  machine: { label: "Machine" },
  environment: { label: "Environment" },
};

/* ------------------------------------------------------------------ */
/* Module 2 — Hospitality checklists                                   */
/* ------------------------------------------------------------------ */

export const HOSPITALITY_CHECKLISTS: Record<
  HospitalityCategory,
  { label: string; items: { key: string; label: string }[] }
> = {
  cashier: {
    label: "Cashier Service",
    items: [
      { key: "greeting", label: "Greeting customer" },
      { key: "eye_contact", label: "Eye contact" },
      { key: "smile", label: "Smile" },
      { key: "offer_menu", label: "Offer menu" },
      { key: "offer_promotion", label: "Offer promotion" },
      { key: "product_knowledge", label: "Product knowledge" },
      { key: "thank_customer", label: "Thank customer" },
    ],
  },
  fnb: {
    label: "F&B Service",
    items: [
      { key: "presentation", label: "Product presentation" },
      { key: "serving_speed", label: "Serving speed" },
      { key: "order_accuracy", label: "Order accuracy" },
      { key: "communication", label: "Communication" },
      { key: "professionalism", label: "Professionalism" },
    ],
  },
  dining_area: {
    label: "Dining Area",
    items: [
      { key: "table_cleanliness", label: "Table cleanliness" },
      { key: "chair_cleanliness", label: "Chair cleanliness" },
      { key: "customer_comfort", label: "Customer comfort" },
      { key: "ambience", label: "Ambience" },
      { key: "customer_interaction", label: "Customer interaction" },
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Module 5 — Hygiene sections                                         */
/* ------------------------------------------------------------------ */

export const HYGIENE_SECTIONS: Record<
  HygieneSection,
  { label: string; subtitle: string; items: { key: string; label: string }[] }
> = {
  front: {
    label: "Area Depan Outlet",
    subtitle: "Section A",
    items: [
      { key: "kaca_depan", label: "Kaca depan" },
      { key: "pintu_masuk", label: "Pintu masuk" },
      { key: "handle_pintu", label: "Handle pintu" },
      { key: "area_parkir", label: "Area parkir" },
      { key: "signage", label: "Signage" },
      { key: "tempat_sampah", label: "Tempat sampah" },
      { key: "lantai_depan", label: "Lantai area depan" },
      { key: "kondisi_tanaman", label: "Kondisi tanaman" },
      { key: "rumput_liar", label: "Rumput liar" },
    ],
  },
  customer: {
    label: "Customer Area",
    subtitle: "Section B",
    items: [
      { key: "meja_customer", label: "Meja customer" },
      { key: "kursi_customer", label: "Kursi customer" },
      { key: "sofa", label: "Sofa" },
      { key: "lantai", label: "Lantai" },
      { key: "ac_kipas", label: "AC/Kipas" },
      { key: "dekorasi", label: "Dekorasi" },
      { key: "musik_ambience", label: "Musik/Ambience" },
      { key: "tempat_sampah", label: "Tempat sampah" },
      { key: "debu_plafon", label: "Debu plafon" },
    ],
  },
  cashier: {
    label: "Kasir",
    subtitle: "Section C",
    items: [
      { key: "meja_kasir", label: "Meja kasir" },
      { key: "pos", label: "POS" },
      { key: "laci_uang", label: "Laci uang" },
      { key: "kabel", label: "Kabel" },
      { key: "peralatan_kerja", label: "Peralatan kerja" },
      { key: "hand_sanitizer", label: "Hand sanitizer" },
    ],
  },
  kitchen: {
    label: "Kitchen",
    subtitle: "Section D",
    items: [
      { key: "meja_kerja", label: "Meja kerja" },
      { key: "peralatan_masak", label: "Peralatan masak" },
      { key: "sink", label: "Sink" },
      { key: "lantai_kitchen", label: "Lantai kitchen" },
      { key: "lemari_penyimpanan", label: "Lemari penyimpanan" },
      { key: "freezer", label: "Freezer" },
      { key: "tempat_sampah", label: "Tempat sampah" },
      { key: "sarung_tangan", label: "Sarung tangan" },
      { key: "penutup_kepala", label: "Penutup kepala" },
      { key: "penutup_mulut", label: "Penutup mulut" },
    ],
  },
  toilet: {
    label: "Toilet",
    subtitle: "Section E",
    items: [
      { key: "closet", label: "Closet" },
      { key: "wastafel", label: "Wastafel" },
      { key: "cermin", label: "Cermin" },
      { key: "lantai", label: "Lantai" },
      { key: "sabun_tangan", label: "Sabun tangan" },
      { key: "tissue", label: "Tissue" },
      { key: "tempat_sampah", label: "Tempat sampah" },
      { key: "aroma_ruangan", label: "Aroma ruangan" },
    ],
  },
  warehouse: {
    label: "Gudang",
    subtitle: "Section F",
    items: [
      { key: "rak_penyimpanan", label: "Rak penyimpanan" },
      { key: "kardus_tertata", label: "Kardus tertata" },
      { key: "area_lantai", label: "Area lantai" },
      { key: "overall_cleanliness", label: "Overall cleanliness" },
    ],
  },
};

export const HYGIENE_PHOTO_GROUPS = ["Front Area", "Customer Area", "Kitchen", "Toilet", "Plant Area"] as const;

/** Organization-wide KPI targets (used for vs-target indicators). */
export const KPI_TARGETS = {
  hospitality: 85,
  hygiene: 85,
  taskCompletion: 90,
  resolution: 90,
} as const;

export const WORK_CATEGORIES = [
  "Maintenance",
  "Renovation",
  "Procurement",
  "Marketing",
  "Operations",
  "HR / Staffing",
  "Finance",
  "IT / Systems",
] as const;
