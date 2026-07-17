import "server-only";

import { db, dbEnabled } from "./db";
import type { EvaluatorKey, ParamScores } from "@/lib/assessment/config";
import type { EvaluatorIdentity } from "@/lib/assessment/session";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Assessment roster & per-participant assignments (settings sourced from User
 * Management). See migration 0030 for the schema and the access model.
 */

export type RosterRole = "karyawan" | "head" | "director" | "hc";

export interface RosterEntry {
  userId: string;
  role: RosterRole;
  scopeDepartmentId: string; // "" unless a Head scoped to a division
  active: boolean;
}

export interface Assignment {
  participantUserId: string;
  atasanUserId: string | null;
  peerUserIds: string[];
}

const VALID_ROLES: RosterRole[] = ["karyawan", "head", "director", "hc"];
const asRole = (v: any): RosterRole => (VALID_ROLES.includes(v) ? v : "karyawan");

/* ---------------- in-memory fallback ---------------- */
const memRoster = new Map<string, RosterEntry>();
const memAssign = new Map<string, Assignment>();
interface MemPeer { scores: ParamScores; note: string; submitted: boolean; submittedAt: string | null }
const memPeer = new Map<string, MemPeer>(); // key `${sessionId}|${reviewerId}`

/* ---------------- roster ---------------- */

export async function listRoster(): Promise<RosterEntry[]> {
  if (!dbEnabled) return [...memRoster.values()];
  try {
    const { data } = await db().from("assessment_roster").select("user_id,role,scope_department_id,active");
    return ((data ?? []) as any[]).map((r) => ({
      userId: r.user_id,
      role: asRole(r.role),
      scopeDepartmentId: r.scope_department_id ?? "",
      active: r.active !== false,
    }));
  } catch {
    return [];
  }
}

export async function saveRosterEntry(input: RosterEntry): Promise<void> {
  const rec: RosterEntry = {
    userId: input.userId,
    role: asRole(input.role),
    scopeDepartmentId: input.role === "head" ? input.scopeDepartmentId || "" : "",
    active: input.active !== false,
  };
  if (!dbEnabled) {
    memRoster.set(rec.userId, rec);
    return;
  }
  await db().from("assessment_roster").upsert({
    user_id: rec.userId,
    role: rec.role,
    scope_department_id: rec.scopeDepartmentId || null,
    active: rec.active,
    updated_at: new Date().toISOString(),
  });
}

export async function removeRosterEntry(userId: string): Promise<void> {
  if (!dbEnabled) {
    memRoster.delete(userId);
    return;
  }
  await db().from("assessment_roster").delete().eq("user_id", userId);
}

/* ---------------- assignments ---------------- */

const asPeerIds = (v: any): string[] => {
  const arr = Array.isArray(v) ? v : [];
  return arr.filter((x) => typeof x === "string" && x).slice(0, 5);
};

export async function listAssignments(): Promise<Assignment[]> {
  if (!dbEnabled) return [...memAssign.values()];
  try {
    const { data } = await db().from("assessment_assignments").select("participant_user_id,atasan_user_id,peer_user_ids");
    return ((data ?? []) as any[]).map((r) => ({
      participantUserId: r.participant_user_id,
      atasanUserId: r.atasan_user_id ?? null,
      peerUserIds: asPeerIds(r.peer_user_ids),
    }));
  } catch {
    return [];
  }
}

export async function saveAssignment(input: Assignment): Promise<void> {
  const rec: Assignment = {
    participantUserId: input.participantUserId,
    atasanUserId: input.atasanUserId || null,
    peerUserIds: asPeerIds(input.peerUserIds),
  };
  if (!dbEnabled) {
    memAssign.set(rec.participantUserId, rec);
    return;
  }
  await db().from("assessment_assignments").upsert({
    participant_user_id: rec.participantUserId,
    atasan_user_id: rec.atasanUserId,
    peer_user_ids: rec.peerUserIds,
    updated_at: new Date().toISOString(),
  });
}

/* ---------------- evaluator identity (from roster) ---------------- */

/**
 * The official single-column identity (al/hc/dir) for a signed-in user, derived
 * from the roster. Rekan Sejawat (peer) are NOT resolved here — they submit via
 * the peer-review path keyed by their own user id.
 */
export async function resolveEvaluatorFromRoster(userId: string): Promise<EvaluatorIdentity | null> {
  const roster = await listRoster();
  const e = roster.find((r) => r.userId === userId && r.active);
  if (!e) return null;
  const key: EvaluatorKey | null = e.role === "head" ? "al" : e.role === "hc" ? "hc" : e.role === "director" ? "dir" : null;
  if (!key) return null;
  return {
    userId,
    evaluatorKey: key,
    scopeDepartmentId: key === "al" ? e.scopeDepartmentId : "",
    displayName: "",
  };
}

/* ---------------- peer reviews ---------------- */

export interface PeerReview {
  reviewerUserId: string;
  scores: ParamScores;
  note: string;
  submitted: boolean;
  submittedAt: string | null;
}

export async function listPeerReviews(sessionId: string): Promise<PeerReview[]> {
  if (!dbEnabled) {
    const out: PeerReview[] = [];
    for (const [k, v] of memPeer) {
      const [sid, rid] = k.split("|");
      if (sid === sessionId) out.push({ reviewerUserId: rid, scores: v.scores, note: v.note, submitted: v.submitted, submittedAt: v.submittedAt });
    }
    return out;
  }
  try {
    const { data } = await db()
      .from("assessment_peer_reviews")
      .select("reviewer_user_id,scores,note,submitted,submitted_at")
      .eq("session_id", sessionId);
    return ((data ?? []) as any[]).map((r) => ({
      reviewerUserId: r.reviewer_user_id,
      scores: (r.scores ?? {}) as ParamScores,
      note: r.note ?? "",
      submitted: !!r.submitted,
      submittedAt: r.submitted_at ?? null,
    }));
  } catch {
    return [];
  }
}

export async function savePeerReview(input: {
  sessionId: string;
  reviewerUserId: string;
  scores?: ParamScores;
  note?: string;
  submitted?: boolean;
}): Promise<void> {
  const now = new Date().toISOString();
  if (!dbEnabled) {
    const key = `${input.sessionId}|${input.reviewerUserId}`;
    const prev = memPeer.get(key) ?? { scores: {}, note: "", submitted: false, submittedAt: null };
    memPeer.set(key, {
      scores: input.scores ?? prev.scores,
      note: input.note ?? prev.note,
      submitted: input.submitted ?? prev.submitted,
      submittedAt: input.submitted ? now : input.submitted === false ? null : prev.submittedAt,
    });
    return;
  }
  const patch: any = { session_id: input.sessionId, reviewer_user_id: input.reviewerUserId, updated_at: now };
  if (input.scores !== undefined) patch.scores = input.scores;
  if (input.note !== undefined) patch.note = input.note;
  if (input.submitted !== undefined) {
    patch.submitted = input.submitted;
    patch.submitted_at = input.submitted ? now : null;
  }
  await db().from("assessment_peer_reviews").upsert(patch, { onConflict: "session_id,reviewer_user_id" });
}

/** Average the submitted peer reviews into one ParamScores (Penilai 3 = rata-rata). */
export function aggregatePeerScores(reviews: PeerReview[]): { scores: ParamScores; submittedCount: number } {
  const submitted = reviews.filter((r) => r.submitted);
  if (submitted.length === 0) return { scores: {}, submittedCount: 0 };
  const keys: (keyof ParamScores)[] = ["kpi", "att", "loy", "skl", "kon", "msk"];
  const out: ParamScores = {};
  for (const k of keys) {
    const vals = submitted.map((r) => r.scores[k]).filter((v): v is number => typeof v === "number" && v > 0);
    if (vals.length) out[k] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }
  return { scores: out, submittedCount: submitted.length };
}
