import "server-only";

import type {
  AppNotification,
  Area,
  Complaint,
  HospitalityAssessment,
  HygieneAudit,
  OpsEvent,
  Outlet,
  UserProfile,
  WorkTask,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** camelCase entities ⇄ snake_case Postgres rows (schema: init_operation_gwg_schema). */

export const userToRow = (u: UserProfile) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  area_id: u.areaId ?? null,
  outlet_ids: u.outletIds ?? [],
  avatar_url: u.avatarUrl ?? null,
  phone: u.phone ?? null,
  country: u.country ?? null,
  active: u.active,
  created_at: u.createdAt,
});
export const userFromRow = (r: any): UserProfile => ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  areaId: r.area_id,
  outletIds: r.outlet_ids ?? [],
  avatarUrl: r.avatar_url,
  phone: r.phone ?? null,
  country: r.country ?? null,
  active: r.active,
  createdAt: r.created_at,
});

export const areaToRow = (a: Area) => ({ id: a.id, name: a.name, code: a.code, coordinator_id: a.coordinatorId });
export const areaFromRow = (r: any): Area => ({ id: r.id, name: r.name, code: r.code, coordinatorId: r.coordinator_id });

export const outletToRow = (o: Outlet) => ({
  id: o.id,
  name: o.name,
  code: o.code,
  city: o.city,
  area_id: o.areaId,
  supervisor_id: o.supervisorId,
  pic_id: o.picId,
  active: o.active,
});
export const outletFromRow = (r: any): Outlet => ({
  id: r.id,
  name: r.name,
  code: r.code,
  city: r.city,
  areaId: r.area_id,
  supervisorId: r.supervisor_id,
  picId: r.pic_id,
  active: r.active,
});

export const hospitalityToRow = (h: HospitalityAssessment) => ({
  id: h.id,
  outlet_id: h.outletId,
  area_id: h.areaId,
  assessor_id: h.assessorId,
  staff_name: h.staffName,
  staff_position: h.staffPosition,
  date: h.date,
  scores: h.scores,
  notes: h.notes ?? null,
  overall_score: h.overallScore,
});
export const hospitalityFromRow = (r: any): HospitalityAssessment => ({
  id: r.id,
  outletId: r.outlet_id,
  areaId: r.area_id,
  assessorId: r.assessor_id,
  staffName: r.staff_name,
  staffPosition: r.staff_position,
  date: r.date,
  scores: r.scores,
  notes: r.notes ?? undefined,
  overallScore: Number(r.overall_score),
});

export const taskToRow = (t: WorkTask) => ({
  id: t.id,
  title: t.title,
  description: t.description,
  category: t.category,
  priority: t.priority,
  status: t.status,
  division: t.division,
  outlet_id: t.outletId,
  area_id: t.areaId,
  pic_ids: t.picIds,
  pic_id: t.picId,
  start_date: t.startDate,
  due_date: t.dueDate,
  completion_date: t.completionDate ?? null,
  progress: t.progress,
  attachments: t.attachments,
  created_at: t.createdAt,
});
export const taskFromRow = (r: any): WorkTask => ({
  id: r.id,
  title: r.title,
  description: r.description,
  category: r.category,
  priority: r.priority,
  status: r.status,
  division: r.division,
  outletId: r.outlet_id,
  areaId: r.area_id,
  picIds: r.pic_ids ?? [],
  picId: r.pic_id,
  startDate: r.start_date,
  dueDate: r.due_date,
  completionDate: r.completion_date,
  progress: r.progress,
  attachments: r.attachments ?? [],
  createdAt: r.created_at,
});

export const eventToRow = (e: OpsEvent) => ({
  id: e.id,
  name: e.name,
  outlet_id: e.outletId,
  area_id: e.areaId,
  pic_id: e.picId,
  description: e.description,
  budget: e.budget,
  start_date: e.startDate,
  end_date: e.endDate,
  milestone: e.milestone,
  status: e.status,
  progress: e.progress,
  created_at: e.createdAt,
});
export const eventFromRow = (r: any): OpsEvent => ({
  id: r.id,
  name: r.name,
  outletId: r.outlet_id,
  areaId: r.area_id,
  picId: r.pic_id,
  description: r.description,
  budget: Number(r.budget),
  startDate: r.start_date,
  endDate: r.end_date,
  milestone: r.milestone,
  status: r.status,
  progress: r.progress,
  createdAt: r.created_at,
});

export const hygieneToRow = (h: HygieneAudit) => ({
  id: h.id,
  outlet_id: h.outletId,
  area_id: h.areaId,
  date: h.date,
  shift: h.shift,
  inspector_name: h.inspectorName,
  supervisor_name: h.supervisorName,
  ratings: h.ratings,
  findings: h.findings,
  photos: h.photos,
  is_clean: h.isClean,
  hygiene_score: h.hygieneScore,
  created_at: h.createdAt,
});
export const hygieneFromRow = (r: any): HygieneAudit => ({
  id: r.id,
  outletId: r.outlet_id,
  areaId: r.area_id,
  date: r.date,
  shift: r.shift,
  inspectorName: r.inspector_name,
  supervisorName: r.supervisor_name,
  ratings: r.ratings,
  findings: r.findings ?? [],
  photos: r.photos ?? [],
  isClean: r.is_clean,
  hygieneScore: Number(r.hygiene_score),
  createdAt: r.created_at,
});

export const complaintToRow = (c: Complaint) => ({
  id: c.id,
  source: c.source,
  customer_name: c.customerName,
  rating: c.rating ?? null,
  content: c.content,
  review_date: c.reviewDate,
  outlet_id: c.outletId,
  area_id: c.areaId,
  category: c.category,
  priority: c.priority,
  status: c.status,
  root_cause: c.rootCause ?? null,
  corrective_action: c.correctiveAction ?? null,
  created_at: c.createdAt,
  closed_at: c.closedAt ?? null,
});
export const complaintFromRow = (r: any): Complaint => ({
  id: r.id,
  source: r.source,
  customerName: r.customer_name,
  rating: r.rating,
  content: r.content,
  reviewDate: r.review_date,
  outletId: r.outlet_id,
  areaId: r.area_id,
  category: r.category,
  priority: r.priority,
  status: r.status,
  rootCause: r.root_cause,
  correctiveAction: r.corrective_action,
  createdAt: r.created_at,
  closedAt: r.closed_at,
});

export const notificationToRow = (n: AppNotification) => ({
  id: n.id,
  kind: n.kind,
  title: n.title,
  message: n.message,
  outlet_id: n.outletId ?? null,
  area_id: n.areaId ?? null,
  severity: n.severity,
  read: n.read,
  created_at: n.createdAt,
});
export const notificationFromRow = (r: any): AppNotification => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  message: r.message,
  outletId: r.outlet_id ?? undefined,
  areaId: r.area_id ?? undefined,
  severity: r.severity,
  read: r.read,
  createdAt: r.created_at,
});
