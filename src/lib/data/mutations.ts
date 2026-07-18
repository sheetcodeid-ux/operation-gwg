import "server-only";

import { randomUUID } from "node:crypto";
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
import {
  deleteEventRow,
  deleteTaskRow,
  deleteHygieneRow,
  deleteHospitalityRow,
  saveComplaint,
  saveEvent,
  saveHospitality,
  saveHygiene,
  saveTask,
  saveArea,
  saveOutlet,
  PersistError,
  type PersistResult,
} from "./persist";

/**
 * Write layer over the in-memory store, mirrored to Supabase.
 *
 * Create paths `await` the write and, on failure, roll the optimistic in-memory
 * insert back out and throw `PersistError` so the server action reports it.
 * Update/delete paths stay fire-and-forget: the TTL re-hydration reconciles the
 * in-memory copy back to the database within one window if the write fails.
 */

/** Collision-free ids (UUID) — process counters reset on serverless cold start
 *  and Date.now() collides under concurrency, so neither is safe for ids. */
const nextId = (prefix: string) => `${prefix}_${randomUUID()}`;
const nowIso = () => new Date().toISOString();
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Remove an item from an array by identity (used to undo an optimistic insert). */
function removeFrom<T>(arr: T[], item: T) {
  const i = arr.indexOf(item);
  if (i >= 0) arr.splice(i, 1);
}

/** Await a create's persistence; on failure undo the insert and throw. */
async function commitInsert<T>(arr: T[], record: T, result: Promise<PersistResult>): Promise<T> {
  const { error } = await result;
  if (error) {
    removeFrom(arr, record);
    throw new PersistError(error);
  }
  return record;
}

function areaForOutlet(outletId: string): string {
  return getOutlet(outletId)?.areaId ?? "area_001";
}

/* ---------------- Hospitality ---------------- */
export async function createHospitality(input: {
  outletId: string;
  assessorId: string;
  staffName: string;
  staffPosition: string;
  scores: Record<HospitalityCategory, Record<string, number>>;
  notes?: string;
  date?: string;
}): Promise<HospitalityAssessment> {
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
    date: input.date || nowIso(),
    scores: input.scores,
    notes: input.notes,
    overallScore: count ? round1((sum / (count * 5)) * 100) : 0,
  };
  SEED.hospitality.unshift(record);
  return commitInsert(SEED.hospitality, record, saveHospitality(record));
}

/* ---------------- Work Tracker ---------------- */
export async function createTask(input: {
  title: string;
  description: string;
  category: string;
  priority: WorkTask["priority"];
  status: WorkTask["status"];
  division: WorkTask["division"];
  outletId: string | null;
  picIds: string[];
  picId: string | null;
  startDate: string;
  dueDate: string;
  progress: number;
}): Promise<WorkTask> {
  const record: WorkTask = {
    id: nextId("tsk"),
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    status: input.status,
    division: input.division,
    outletId: input.outletId,
    areaId: input.outletId ? areaForOutlet(input.outletId) : null,
    picIds: input.picIds,
    picId: input.picIds[0] ?? input.picId,
    startDate: input.startDate,
    dueDate: input.dueDate,
    completionDate: input.status === "done" ? nowIso() : null,
    progress: input.status === "done" ? 100 : input.progress,
    attachments: [],
    createdAt: nowIso(),
  };
  SEED.tasks.unshift(record);
  return commitInsert(SEED.tasks, record, saveTask(record));
}

export function updateTask(
  id: string,
  input: {
    title: string;
    description: string;
    category: string;
    priority: WorkTask["priority"];
    status: WorkTask["status"];
    division: WorkTask["division"];
    outletId: string | null;
    picIds: string[];
    picId: string | null;
    startDate: string;
    dueDate: string;
    progress: number;
  },
): WorkTask | undefined {
  const task = SEED.tasks.find((t) => t.id === id);
  if (!task) return;
  task.title = input.title;
  task.description = input.description;
  task.category = input.category;
  task.priority = input.priority;
  task.status = input.status;
  task.division = input.division;
  task.outletId = input.outletId;
  task.areaId = input.outletId ? areaForOutlet(input.outletId) : null;
  task.picIds = input.picIds;
  task.picId = input.picIds[0] ?? input.picId;
  task.startDate = input.startDate;
  task.dueDate = input.dueDate;
  task.progress = input.status === "done" ? 100 : input.progress;
  task.completionDate = input.status === "done" ? task.completionDate ?? nowIso() : null;
  void saveTask(task);
  return task;
}

export function deleteTask(id: string): boolean {
  const i = SEED.tasks.findIndex((t) => t.id === id);
  if (i === -1) return false;
  SEED.tasks.splice(i, 1);
  void deleteTaskRow(id);
  return true;
}

export function deleteHygiene(id: string): boolean {
  const i = SEED.hygiene.findIndex((h) => h.id === id);
  if (i === -1) return false;
  SEED.hygiene.splice(i, 1);
  void deleteHygieneRow(id);
  return true;
}

export function deleteHospitality(id: string): boolean {
  const i = SEED.hospitality.findIndex((h) => h.id === id);
  if (i === -1) return false;
  SEED.hospitality.splice(i, 1);
  void deleteHospitalityRow(id);
  return true;
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
  void saveTask(task);
}

/* ---------------- Event Tracker ---------------- */
export async function createEvent(input: {
  name: string;
  outletId: string;
  picId: string;
  description: string;
  budget: number;
  startDate: string;
  endDate: string;
  milestone: OpsEvent["milestone"];
  status: OpsEvent["status"];
}): Promise<OpsEvent> {
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
  return commitInsert(SEED.events, record, saveEvent(record));
}

export function updateEvent(
  id: string,
  input: {
    name: string;
    outletId: string;
    picId: string;
    description: string;
    budget: number;
    startDate: string;
    endDate: string;
    milestone: OpsEvent["milestone"];
    status: OpsEvent["status"];
  },
): OpsEvent | undefined {
  const ev = SEED.events.find((e) => e.id === id);
  if (!ev) return;
  ev.name = input.name;
  ev.outletId = input.outletId;
  ev.areaId = areaForOutlet(input.outletId);
  ev.picId = input.picId;
  ev.description = input.description;
  ev.budget = input.budget;
  ev.startDate = input.startDate;
  ev.endDate = input.endDate;
  ev.milestone = input.milestone;
  ev.status = input.status;
  ev.progress = EVENT_MILESTONES.find((m) => m.value === input.milestone)?.progress ?? ev.progress;
  void saveEvent(ev);
  return ev;
}

export function deleteEvent(id: string): boolean {
  const i = SEED.events.findIndex((e) => e.id === id);
  if (i === -1) return false;
  SEED.events.splice(i, 1);
  void deleteEventRow(id);
  return true;
}

export function updateEventMilestone(id: string, milestone: OpsEvent["milestone"]) {
  const ev = SEED.events.find((e) => e.id === id);
  if (!ev) return;
  ev.milestone = milestone;
  ev.progress = EVENT_MILESTONES.find((m) => m.value === milestone)?.progress ?? ev.progress;
  void saveEvent(ev);
}

/* ---------------- Hygiene ---------------- */
export async function createHygiene(input: {
  outletId: string;
  shift: string;
  inspectorName: string;
  supervisorName: string;
  ratings: Record<HygieneSection, Record<string, HygieneRating>>;
  findings: string[];
  photos?: import("../types").Attachment[];
  isClean: boolean;
  date?: string;
}): Promise<HygieneAudit> {
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
    date: input.date || nowIso(),
    shift: input.shift,
    inspectorName: input.inspectorName,
    supervisorName: input.supervisorName,
    ratings: input.ratings,
    findings: input.findings,
    photos: input.photos ?? [],
    isClean: input.isClean,
    hygieneScore: score,
    createdAt: nowIso(),
  };
  SEED.hygiene.unshift(record);
  return commitInsert(SEED.hygiene, record, saveHygiene(record));
}

/* ---------------- Complaints ---------------- */
export async function createComplaint(input: {
  source: Complaint["source"];
  customerName: string;
  rating?: number | null;
  content: string;
  outletId: string;
  category: Complaint["category"];
  priority: Complaint["priority"];
}): Promise<Complaint> {
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
  return commitInsert(SEED.complaints, record, saveComplaint(record));
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
  void saveComplaint(c);
}

/* ---------------- Organization (areas & outlets) ---------------- */
export async function createArea(input: { name: string; code: string; coordinatorId: string }) {
  const record = { id: nextId("area"), name: input.name, code: input.code, coordinatorId: input.coordinatorId };
  SEED.areas.push(record);
  return commitInsert(SEED.areas, record, saveArea(record));
}

export async function createOutlet(input: { name: string; code: string; city: string; areaId: string; picId: string }) {
  const record = {
    id: nextId("out"),
    name: input.name,
    code: input.code,
    city: input.city,
    areaId: input.areaId,
    supervisorId: input.picId,
    picId: input.picId,
    active: true,
  };
  SEED.outlets.push(record);
  return commitInsert(SEED.outlets, record, saveOutlet(record));
}
