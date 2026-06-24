import "server-only";

import { HOSPITALITY_CHECKLISTS, HYGIENE_RATING_META, HYGIENE_SECTIONS, EVENT_MILESTONES } from "../constants";
import type {
  Complaint,
  CorrectiveAction,
  HospitalityAssessment,
  HospitalityCategory,
  HygieneAudit,
  HygieneRating,
  HygieneSection,
  OpsEvent,
  WorkTask,
} from "../types";
import { SEED } from "./seed";
import { getOutlet } from "./store";

/**
 * Demo-mode write layer. Mutates the in-memory seed (persists for the life of
 * the server process). Phase 11 replaces each function body with a Supabase
 * insert/update; signatures and derived-score logic stay identical.
 */

let counter = 9000;
const nextId = (prefix: string) => `${prefix}_${++counter}`;
const nowIso = () => new Date().toISOString();
const round1 = (n: number) => Math.round(n * 10) / 10;

function areaForOutlet(outletId: string): string {
  return getOutlet(outletId)?.areaId ?? "area_001";
}

/* ---------------- Hospitality ---------------- */
export function createHospitality(input: {
  outletId: string;
  assessorId: string;
  staffName: string;
  staffPosition: string;
  scores: Record<HospitalityCategory, Record<string, number>>;
  notes?: string;
}): HospitalityAssessment {
  let sum = 0;
  let count = 0;
  (Object.keys(HOSPITALITY_CHECKLISTS) as HospitalityCategory[]).forEach((cat) => {
    for (const item of HOSPITALITY_CHECKLISTS[cat].items) {
      sum += input.scores[cat]?.[item.key] ?? 0;
      count += 1;
    }
  });
  const record: HospitalityAssessment = {
    id: nextId("hsp"),
    outletId: input.outletId,
    areaId: areaForOutlet(input.outletId),
    assessorId: input.assessorId,
    staffName: input.staffName,
    staffPosition: input.staffPosition,
    date: nowIso(),
    scores: input.scores,
    notes: input.notes,
    overallScore: count ? round1((sum / (count * 5)) * 100) : 0,
  };
  SEED.hospitality.unshift(record);
  return record;
}

/* ---------------- Work Tracker ---------------- */
export function createTask(input: {
  title: string;
  description: string;
  category: string;
  priority: WorkTask["priority"];
  status: WorkTask["status"];
  outletId: string;
  picId: string;
  startDate: string;
  dueDate: string;
  progress: number;
}): WorkTask {
  const record: WorkTask = {
    id: nextId("tsk"),
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    status: input.status,
    outletId: input.outletId,
    areaId: areaForOutlet(input.outletId),
    picId: input.picId,
    startDate: input.startDate,
    dueDate: input.dueDate,
    completionDate: input.status === "done" ? nowIso() : null,
    progress: input.status === "done" ? 100 : input.progress,
    attachments: [],
    createdAt: nowIso(),
  };
  SEED.tasks.unshift(record);
  return record;
}

export function updateTaskStatus(id: string, status: WorkTask["status"], progress?: number) {
  const task = SEED.tasks.find((t) => t.id === id);
  if (!task) return;
  task.status = status;
  if (status === "done") {
    task.progress = 100;
    task.completionDate = nowIso();
  } else if (progress !== undefined) {
    task.progress = progress;
  }
}

/* ---------------- Event Tracker ---------------- */
export function createEvent(input: {
  name: string;
  outletId: string;
  picId: string;
  description: string;
  budget: number;
  startDate: string;
  endDate: string;
  milestone: OpsEvent["milestone"];
  status: OpsEvent["status"];
}): OpsEvent {
  const progress = EVENT_MILESTONES.find((m) => m.value === input.milestone)?.progress ?? 0;
  const record: OpsEvent = {
    id: nextId("evt"),
    name: input.name,
    outletId: input.outletId,
    areaId: areaForOutlet(input.outletId),
    picId: input.picId,
    description: input.description,
    budget: input.budget,
    startDate: input.startDate,
    endDate: input.endDate,
    milestone: input.milestone,
    status: input.status,
    progress,
    createdAt: nowIso(),
  };
  SEED.events.unshift(record);
  return record;
}

/* ---------------- Hygiene ---------------- */
export function createHygiene(input: {
  outletId: string;
  shift: string;
  inspectorName: string;
  supervisorName: string;
  ratings: Record<HygieneSection, Record<string, HygieneRating>>;
  findings: string[];
  isClean: boolean;
}): HygieneAudit {
  let sum = 0;
  let count = 0;
  (Object.keys(HYGIENE_SECTIONS) as HygieneSection[]).forEach((sec) => {
    for (const item of HYGIENE_SECTIONS[sec].items) {
      const r = input.ratings[sec]?.[item.key];
      if (r) {
        sum += HYGIENE_RATING_META[r].score;
        count += 1;
      }
    }
  });
  const score = count ? round1(sum / count) : 0;
  const record: HygieneAudit = {
    id: nextId("hyg"),
    outletId: input.outletId,
    areaId: areaForOutlet(input.outletId),
    date: nowIso(),
    shift: input.shift,
    inspectorName: input.inspectorName,
    supervisorName: input.supervisorName,
    ratings: input.ratings,
    findings: input.findings,
    photos: [],
    isClean: input.isClean,
    hygieneScore: score,
    createdAt: nowIso(),
  };
  SEED.hygiene.unshift(record);
  return record;
}

/* ---------------- Complaints ---------------- */
export function createComplaint(input: {
  source: Complaint["source"];
  customerName: string;
  rating?: number | null;
  content: string;
  outletId: string;
  category: Complaint["category"];
  priority: Complaint["priority"];
}): Complaint {
  const record: Complaint = {
    id: nextId("cmp"),
    source: input.source,
    customerName: input.customerName,
    rating: input.rating ?? null,
    content: input.content,
    reviewDate: nowIso(),
    outletId: input.outletId,
    areaId: areaForOutlet(input.outletId),
    category: input.category,
    priority: input.priority,
    status: "open",
    rootCause: null,
    correctiveAction: null,
    createdAt: nowIso(),
    closedAt: null,
  };
  SEED.complaints.unshift(record);
  return record;
}

export function resolveComplaint(input: {
  id: string;
  status: Complaint["status"];
  rootCause?: Complaint["rootCause"];
  correctiveAction?: CorrectiveAction;
}) {
  const c = SEED.complaints.find((x) => x.id === input.id);
  if (!c) return;
  c.status = input.status;
  if (input.rootCause) c.rootCause = input.rootCause;
  if (input.correctiveAction) c.correctiveAction = input.correctiveAction;
  if (input.status === "closed" || input.status === "done") c.closedAt = nowIso();
}
