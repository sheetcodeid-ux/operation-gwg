/**
 * Deterministic seed dataset for Operation GWG.
 *
 * Generated once at module load via a seeded PRNG so every server render sees
 * identical data (no hydration drift). In Phase 11 these structures are
 * replaced by live Supabase queries — the shapes already match `types.ts`.
 */

import { EVENT_MILESTONES, HOSPITALITY_CHECKLISTS, HYGIENE_RATING_META, HYGIENE_SECTIONS } from "../constants";
import type {
  Area,
  AppNotification,
  Complaint,
  ComplaintCategory,
  ComplaintSource,
  ComplaintStatus,
  HospitalityAssessment,
  HospitalityCategory,
  HygieneAudit,
  HygieneSection,
  OpsEvent,
  Outlet,
  Priority,
  Role,
  RootCauseCategory,
  TaskStatus,
  UserProfile,
  WorkTask,
} from "../types";

/* ---------------- seeded PRNG ---------------- */
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260623);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));
const chance = (p: number) => rand() < p;
const id = (prefix: string, n: number) => `${prefix}_${String(n).padStart(3, "0")}`;

function daysAgo(n: number) {
  const d = new Date("2026-06-23T08:00:00Z");
  d.setDate(d.getDate() - n);
  return d.toISOString();
}
function daysAhead(n: number) {
  return daysAgo(-n);
}

/* ---------------- name pools ---------------- */
const FIRST = ["Andi", "Budi", "Citra", "Dewi", "Eka", "Fajar", "Gita", "Hadi", "Indah", "Joko", "Kiki", "Lina", "Maya", "Nanda", "Oki", "Putri", "Rama", "Sari", "Tari", "Umar", "Vina", "Wawan", "Yuni", "Zaki"];
const LAST = ["Pratama", "Wijaya", "Santoso", "Halim", "Nugroho", "Saputra", "Kusuma", "Permana", "Lestari", "Hidayat", "Maulana", "Anggraini", "Firmansyah", "Suryadi"];
const CITIES = ["Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Semarang", "Medan", "Makassar", "Denpasar", "Bekasi", "Tangerang"];
const AREA_NAMES = ["Jakarta Metro", "West Java", "East Java", "Central Java", "Outer Islands"];
const POSITIONS = ["Cashier", "Barista", "Server", "Cook", "Floor Staff", "Shift Lead"];

const fullName = () => `${pick(FIRST)} ${pick(LAST)}`;

/* ---------------- build org ---------------- */
const users: UserProfile[] = [];
let userN = 0;
function addUser(role: Role, partial: Partial<UserProfile> = {}): UserProfile {
  userN += 1;
  const name = partial.name ?? fullName();
  const u: UserProfile = {
    id: id("usr", userN),
    name,
    email: partial.email ?? `${name.toLowerCase().replace(/\s+/g, ".")}@gwg.co`,
    role,
    areaId: partial.areaId ?? null,
    outletIds: partial.outletIds ?? [],
    avatarUrl: null,
    active: true,
    createdAt: daysAgo(intBetween(200, 600)),
    ...partial,
  };
  users.push(u);
  return u;
}

// Platform / HQ users (no branch)
const superAdmin = addUser("super_admin", { name: "GWG Admin", email: "admin@gwg.co" });
addUser("head_operation", { name: "Head of Operations", email: "head.ops@gwg.co" });
addUser("data_operation", { name: "Data Operation", email: "data.ops@gwg.co" });
addUser("admin_operation", { name: "Admin Operation", email: "admin.ops@gwg.co" });

const areas: Area[] = [];
const outlets: Outlet[] = [];

for (let a = 0; a < 5; a++) {
  const coordinator = addUser("area_coordinator", { name: fullName() });
  const area: Area = {
    id: id("area", a + 1),
    name: AREA_NAMES[a],
    code: `A${a + 1}`,
    coordinatorId: coordinator.id,
  };
  coordinator.areaId = area.id;
  areas.push(area);

  // 10 outlets per area — one POS Operation (on-site) per outlet, scoped to that branch.
  const areaOutletIds: string[] = [];
  for (let o = 0; o < 10; o++) {
    const outletNum = a * 10 + o + 1;
    const pos = addUser("pos_operation", { name: fullName() });
    const outlet: Outlet = {
      id: id("out", outletNum),
      name: `GWG ${pick(CITIES)} ${String.fromCharCode(65 + (o % 26))}${outletNum}`,
      code: `${area.code}-${String(outletNum).padStart(2, "0")}`,
      city: pick(CITIES),
      areaId: area.id,
      supervisorId: pos.id,
      picId: pos.id,
      active: chance(0.96),
    };
    pos.outletIds = [outlet.id];
    areaOutletIds.push(outlet.id);
    outlets.push(outlet);
  }

  // Area Coordinator is assigned to several specific outlets (default: all in their area; editable).
  coordinator.outletIds = areaOutletIds;
}

const areaCoordinators = users.filter((u) => u.role === "area_coordinator");
const outletById = new Map(outlets.map((o) => [o.id, o]));
const coordinatorForArea = (areaId: string) => areaCoordinators.find((c) => c.areaId === areaId)!;

/* ---------------- Module 2: Hospitality ---------------- */
const hospitality: HospitalityAssessment[] = [];
let hN = 0;
for (const outlet of outlets) {
  const count = intBetween(12, 16);
  for (let i = 0; i < count; i++) {
    hN += 1;
    const scores = {} as HospitalityAssessment["scores"];
    let sum = 0;
    let items = 0;
    (Object.keys(HOSPITALITY_CHECKLISTS) as HospitalityCategory[]).forEach((cat) => {
      scores[cat] = {};
      for (const item of HOSPITALITY_CHECKLISTS[cat].items) {
        const v = intBetween(3, 5);
        scores[cat][item.key] = v;
        sum += v;
        items += 1;
      }
    });
    hospitality.push({
      id: id("hsp", hN),
      outletId: outlet.id,
      areaId: outlet.areaId,
      assessorId: coordinatorForArea(outlet.areaId).id,
      staffName: fullName(),
      staffPosition: pick(POSITIONS),
      date: i === 0 ? daysAgo(intBetween(1, 20)) : daysAgo(intBetween(1, 365)),
      scores,
      overallScore: Math.round((sum / (items * 5)) * 1000) / 10,
    });
  }
}

/* ---------------- Module 3: Work Tracker ---------------- */
const TASK_TITLES = ["AC service & cleaning", "Repaint front signage", "Restock kitchen supplies", "Fix leaking sink", "Staff hospitality training", "POS system update", "Grease trap cleaning", "New menu rollout", "CCTV maintenance", "Pest control treatment", "Inventory audit", "Generator inspection"];
const PRIORITIES: Priority[] = ["critical", "high", "medium", "low"];
const TASK_STATES: TaskStatus[] = ["open", "ongoing", "pending", "done", "cancelled"];
const TASK_DIVISIONS: Role[] = ["head_operation", "area_coordinator", "data_operation", "pos_operation", "admin_operation"];
const tasks: WorkTask[] = [];
let tN = 0;
for (const outlet of outlets) {
  const count = intBetween(2, 5);
  for (let i = 0; i < count; i++) {
    tN += 1;
    const status = pick(TASK_STATES);
    const start = intBetween(2, 50);
    const due = start - intBetween(2, 20);
    const progress = status === "done" ? 100 : status === "cancelled" ? intBetween(0, 60) : status === "ongoing" ? intBetween(20, 90) : status === "pending" ? intBetween(10, 70) : intBetween(0, 20);
    // ~1 in 5 tasks is a division-level task with no branch.
    const noBranch = chance(0.2);
    tasks.push({
      id: id("tsk", tN),
      title: pick(TASK_TITLES),
      description: "Operational task tracked under the outlet work program.",
      category: pick(["Maintenance", "Operations", "Procurement", "Marketing", "IT / Systems"]),
      priority: pick(PRIORITIES),
      status,
      division: noBranch ? pick(["data_operation", "admin_operation", "head_operation"] as Role[]) : pick(TASK_DIVISIONS),
      outletId: noBranch ? null : outlet.id,
      areaId: noBranch ? null : outlet.areaId,
      picIds: noBranch ? [] : [outlet.picId],
      picId: noBranch ? null : outlet.picId,
      startDate: daysAgo(start),
      dueDate: due >= 0 ? daysAgo(due) : daysAhead(-due),
      completionDate: status === "done" ? daysAgo(Math.max(0, due + 1)) : null,
      progress: Math.round(progress),
      attachments: [],
      createdAt: daysAgo(start),
    });
  }
}

/* ---------------- Module 4: Event Tracker ---------------- */
const EVENT_NAMES = ["Grand Opening Promo", "Ramadan Special", "Anniversary Celebration", "Weekend Live Music", "Loyalty Member Day", "New Product Launch", "Community Gathering", "Year-End Sale"];
const events: OpsEvent[] = [];
let eN = 0;
for (const outlet of outlets) {
  if (!chance(0.55)) continue;
  const count = intBetween(1, 2);
  for (let i = 0; i < count; i++) {
    eN += 1;
    const milestone = pick(EVENT_MILESTONES).value;
    const progress = EVENT_MILESTONES.find((m) => m.value === milestone)!.progress;
    const status = milestone === "evaluation" ? (chance(0.8) ? "finished" : "running") : chance(0.3) ? "upcoming" : "running";
    const start = intBetween(-20, 40);
    events.push({
      id: id("evt", eN),
      name: pick(EVENT_NAMES),
      outletId: outlet.id,
      areaId: outlet.areaId,
      picId: outlet.picId,
      description: "Branch-level event tracked end to end across milestones.",
      budget: intBetween(5, 80) * 1_000_000,
      startDate: start >= 0 ? daysAgo(start) : daysAhead(-start),
      endDate: daysAhead(intBetween(1, 30)),
      milestone,
      status,
      progress,
      createdAt: daysAgo(Math.max(1, start)),
    });
  }
}

/* ---------------- Module 5: Hygiene ---------------- */
const FINDINGS_POOL = ["Lampu mati di area toilet", "Kebocoran kecil pada sink kitchen", "Bau tidak sedap di area sampah", "General cleaning diperlukan di gudang", "Debu pada plafon customer area", "Signage kotor"];
const hygiene: HygieneAudit[] = [];
let gN = 0;
for (const outlet of outlets) {
  const count = intBetween(12, 16);
  for (let i = 0; i < count; i++) {
    gN += 1;
    const ratings = {} as HygieneAudit["ratings"];
    let sum = 0;
    let items = 0;
    (Object.keys(HYGIENE_SECTIONS) as HygieneSection[]).forEach((sec) => {
      ratings[sec] = {};
      for (const item of HYGIENE_SECTIONS[sec].items) {
        // weight toward better ratings
        const r = rand() < 0.55 ? "excellent" : rand() < 0.75 ? "good" : rand() < 0.92 ? "fair" : "poor";
        ratings[sec][item.key] = r;
        sum += HYGIENE_RATING_META[r].score;
        items += 1;
      }
    });
    const score = Math.round((sum / items) * 10) / 10;
    hygiene.push({
      id: id("hyg", gN),
      outletId: outlet.id,
      areaId: outlet.areaId,
      date: i === 0 ? daysAgo(intBetween(1, 20)) : daysAgo(intBetween(1, 365)),
      shift: pick(["Morning", "Afternoon", "Evening"]),
      inspectorName: coordinatorForArea(outlet.areaId).name,
      supervisorName: users.find((u) => u.id === outlet.supervisorId)!.name,
      ratings,
      findings: chance(0.5) ? [pick(FINDINGS_POOL)] : [],
      photos: [],
      isClean: score >= 70,
      hygieneScore: score,
      createdAt: daysAgo(intBetween(1, 45)),
    });
  }
}

/* ---------------- Module 6: Complaints ---------------- */
const SOURCES: ComplaintSource[] = ["google_review", "instagram", "whatsapp", "email", "walk_in"];
const CATEGORIES: ComplaintCategory[] = ["cleanliness", "service", "product_quality", "price", "facilities", "staff_attitude", "waiting_time", "others"];
const CSTATES: ComplaintStatus[] = ["open", "ongoing", "pending", "done", "closed"];
const RCA: RootCauseCategory[] = ["man", "method", "material", "machine", "environment"];
const COMPLAINT_TEXT = ["Pelayanan lambat saat jam sibuk.", "Meja kurang bersih ketika datang.", "Pesanan tidak sesuai.", "Harga dirasa terlalu mahal.", "AC kurang dingin.", "Staff kurang ramah.", "Antrian terlalu panjang.", "Toilet kurang terawat."];
const complaints: Complaint[] = [];
let cN = 0;
for (const outlet of outlets) {
  const count = intBetween(3, 9);
  for (let i = 0; i < count; i++) {
    cN += 1;
    const source = pick(SOURCES);
    const status = pick(CSTATES);
    // Spread across the past ~12 months so every month has complaints (daily & yearly views).
    const created = intBetween(1, 365);
    const resolved = status === "closed" || status === "done";
    complaints.push({
      id: id("cmp", cN),
      source,
      customerName: chance(0.7) ? fullName() : "Anonymous",
      rating: source === "google_review" ? intBetween(1, 4) : null,
      content: pick(COMPLAINT_TEXT),
      reviewDate: daysAgo(created),
      outletId: outlet.id,
      areaId: outlet.areaId,
      category: pick(CATEGORIES),
      priority: pick(PRIORITIES),
      status,
      rootCause: resolved ? pick(RCA) : chance(0.4) ? pick(RCA) : null,
      correctiveAction: resolved
        ? {
            actionDate: daysAgo(Math.max(0, created - intBetween(1, 5))),
            picId: coordinatorForArea(outlet.areaId).id,
            description: "Corrective action executed and verified on site.",
            followUpDate: daysAgo(Math.max(0, created - intBetween(6, 10))),
          }
        : null,
      createdAt: daysAgo(created),
      closedAt: resolved ? daysAgo(Math.max(0, created - intBetween(1, 8))) : null,
    });
  }
}

/* ---------------- Notifications ---------------- */
const notifications: AppNotification[] = [];
let nN = 0;
function addNotif(n: Omit<AppNotification, "id">) {
  nN += 1;
  notifications.push({ id: id("ntf", nN), ...n });
}
tasks
  .filter((t) => t.outletId != null && t.status !== "done" && t.status !== "cancelled" && new Date(t.dueDate) < new Date(daysAgo(0)))
  .slice(0, 6)
  .forEach((t) => {
    const o = outletById.get(t.outletId!)!;
    addNotif({ kind: "task_overdue", title: "Task overdue", message: `"${t.title}" at ${o.name} is past due.`, outletId: o.id, areaId: o.areaId, severity: "warning", read: false, createdAt: t.dueDate });
  });
complaints
  .filter((c) => c.status === "open" && new Date(c.createdAt) < new Date(daysAgo(7)))
  .slice(0, 5)
  .forEach((c) => {
    const o = outletById.get(c.outletId)!;
    addNotif({ kind: "complaint_overdue", title: "Complaint overdue", message: `Unresolved complaint at ${o.name} for 7+ days.`, outletId: o.id, areaId: o.areaId, severity: "critical", read: false, createdAt: c.createdAt });
  });
events
  .filter((e) => e.status !== "finished")
  .slice(0, 4)
  .forEach((e) => {
    const o = outletById.get(e.outletId)!;
    addNotif({ kind: "event_deadline", title: "Event deadline approaching", message: `"${e.name}" at ${o.name} ends soon.`, outletId: o.id, areaId: o.areaId, severity: "info", read: chance(0.4), createdAt: e.startDate });
  });
hygiene
  .filter((h) => h.hygieneScore < 70)
  .slice(0, 3)
  .forEach((h) => {
    const o = outletById.get(h.outletId)!;
    addNotif({ kind: "score_drop", title: "Hygiene score dropped", message: `${o.name} hygiene score fell to ${h.hygieneScore}.`, outletId: o.id, areaId: o.areaId, severity: "warning", read: false, createdAt: h.date });
  });

notifications.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

const freshSeed = {
  users,
  areas,
  outlets,
  hospitality,
  tasks,
  events,
  hygiene,
  complaints,
  notifications,
  /** Default identity used before auth is wired (Phase 2 uses real session). */
  currentUser: superAdmin,
};

/**
 * Pin the in-memory store to a single per-process instance.
 *
 * In dev, Next.js re-evaluates modules on HMR and may load this module into
 * more than one server module graph (the Server Action layer vs. the RSC render
 * layer). Without this, a write (e.g. `createTask` pushing to `SEED.tasks`) and
 * the subsequent read could touch *different* freshly-rebuilt copies, so newly
 * created tasks would silently vanish on the next render. Caching on
 * `globalThis` guarantees every importer shares the same object.
 */
const globalStore = globalThis as typeof globalThis & { __GWG_SEED__?: typeof freshSeed };
export const SEED = (globalStore.__GWG_SEED__ ??= freshSeed);
