import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import type {
  EvaluationState,
  EvaluatorIdentity,
  SessionSeed,
  SessionState,
} from "../assessment/session";
import type { DimensionScores, EvaluatorKey, IvRecValue, ParamScores } from "../assessment/config";
import { aggregatePeerScores, listAssignments, listPeerReviews } from "./assessment-roster";

/** Nominal Rekan Sejawat panel size (spec: rata-rata 5 rekan sejawat). Used as
 *  the expected-peer fallback when a participant has no explicit assignment yet,
 *  so progress still reads "0/5" and nudges HC to appoint the panel. */
const NOMINAL_PEERS = 5;

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Server-only data access for the grade-promotion assessment.
 *
 * When Supabase is configured every read/write goes through the service-role
 * client (RLS is locked down; the browser never touches these tables). When it
 * is not (pure demo/local), an in-memory store keeps the same behaviour so the
 * UI still works — data just doesn't survive a restart.
 */

/* ---------------- row mappers ---------------- */

const sessionFromRow = (r: any, loaded: LoadedEvaluations): SessionState => ({
  id: r.id,
  batch: r.batch ?? "",
  nik: r.nik ?? "",
  participantUserId: r.participant_user_id ?? "",
  employeeName: r.employee_name ?? "",
  jabatan: r.jabatan ?? "",
  departmentId: r.department_id ?? "",
  departmentName: r.department_name ?? "",
  golongan: r.golongan ?? "",
  golonganTujuan: r.golongan_tujuan ?? "",
  directorOnly: !!r.director_only,
  selfScores: (r.self_scores ?? {}) as ParamScores,
  financialImpact: !!r.financial_impact,
  ivNote: r.iv_note ?? "",
  status: r.status ?? "proses",
  evaluations: loaded.evals,
  peerSubmitted: loaded.peerSubmitted,
  peerExpected: loaded.peerExpected,
  createdBy: r.created_by ?? null,
  updatedAt: r.updated_at ?? r.created_at ?? new Date().toISOString(),
});

const evaluationFromRow = (r: any): EvaluationState => ({
  evaluatorKey: r.evaluator_key as EvaluatorKey,
  evaluatorUserId: r.evaluator_user_id ?? null,
  scores: (r.scores ?? {}) as ParamScores,
  note: r.note ?? "",
  interview: (r.interview ?? {}) as DimensionScores,
  ivVote: (r.iv_vote ?? null) as IvRecValue | null,
  submitted: !!r.submitted,
  submittedAt: r.submitted_at ?? null,
  updatedAt: r.updated_at ?? new Date().toISOString(),
});

/* ---------------- in-memory fallback ---------------- */

interface MemSession { row: any; evals: Map<EvaluatorKey, any> }
const memSessions = new Map<string, MemSession>();
const memEvaluators = new Map<string, EvaluatorIdentity>();

const nowIso = () => new Date().toISOString();
const newId = () => randomUUID();

/* ---------------- evaluator identity ---------------- */

export async function resolveEvaluator(userId: string): Promise<EvaluatorIdentity | null> {
  if (!dbEnabled) return memEvaluators.get(userId) ?? null;
  const { data } = await db()
    .from("assessment_evaluators")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    userId: data.user_id,
    evaluatorKey: data.evaluator_key as EvaluatorKey,
    scopeDepartmentId: data.scope_department_id ?? "",
    displayName: data.display_name ?? "",
  };
}

/* ---------------- session reads ---------------- */

interface LoadedEvaluations {
  evals: EvaluationState[];
  /** How many assigned peers have submitted their review. */
  peerSubmitted: number;
  /** How many peers are expected on the panel (assignment size, else nominal 5). */
  peerExpected: number;
}

/** How many Rekan Sejawat are expected for a participant — the size of their
 *  assigned peer panel, falling back to the nominal 5 when none is set yet. */
async function expectedPeerCount(participantUserId: string): Promise<number> {
  if (!participantUserId) return NOMINAL_PEERS;
  const assigns = await listAssignments();
  const n = assigns.find((a) => a.participantUserId === participantUserId)?.peerUserIds.length ?? 0;
  return n > 0 ? n : NOMINAL_PEERS;
}

/** Synthesize the Penilai 3 (Rekan Sejawat) column from the averaged, submitted
 *  peer reviews, plus the panel progress (submitted / expected). */
async function peerAggregate(
  sessionId: string,
  participantUserId: string,
): Promise<{ state: EvaluationState | null; submitted: number; expected: number }> {
  const [reviews, expected] = await Promise.all([listPeerReviews(sessionId), expectedPeerCount(participantUserId)]);
  const { scores, submittedCount } = aggregatePeerScores(reviews);
  // No review row at all → no synthetic peer column, but still report the panel
  // size so the dashboard can show "0/5".
  if (reviews.length === 0) return { state: null, submitted: 0, expected };
  const state: EvaluationState = {
    evaluatorKey: "peer",
    evaluatorUserId: null,
    scores,
    note:
      submittedCount > 0
        ? `Rata-rata ${submittedCount} dari ${expected} rekan sejawat`
        : "Menunggu rekan sejawat",
    interview: {},
    ivVote: null,
    // "submitted" here means the panel is COMPLETE (all expected peers in) — a
    // partial panel (e.g. 1/5) is still in progress.
    submitted: expected > 0 && submittedCount >= expected,
    submittedAt: null,
    updatedAt: new Date().toISOString(),
  };
  return { state, submitted: submittedCount, expected };
}

async function loadEvaluations(sessionId: string, participantUserId: string): Promise<LoadedEvaluations> {
  let official: EvaluationState[];
  if (!dbEnabled) {
    const s = memSessions.get(sessionId);
    official = s ? [...s.evals.values()].map(evaluationFromRow) : [];
  } else {
    const { data } = await db().from("assessment_evaluations").select("*").eq("session_id", sessionId);
    official = (data ?? []).map(evaluationFromRow);
  }
  // Peer (Penilai 3) never lives in assessment_evaluations — it's the average of
  // the per-reviewer rows. Drop any stray 'peer' row and inject the aggregate.
  const rest = official.filter((e) => e.evaluatorKey !== "peer");
  const peer = await peerAggregate(sessionId, participantUserId);
  return {
    evals: peer.state ? [...rest, peer.state] : rest,
    peerSubmitted: peer.submitted,
    peerExpected: peer.expected,
  };
}

/** Find a session by the participant's account id (read-only, no create). */
export async function getSessionByParticipant(participantUserId: string): Promise<SessionState | null> {
  if (!participantUserId) return null;
  if (!dbEnabled) {
    for (const { row } of memSessions.values()) if (row.participant_user_id === participantUserId) return sessionFromRow(row, await loadEvaluations(row.id, row.participant_user_id ?? ""));
    return null;
  }
  const { data } = await db().from("assessment_sessions").select("*").eq("participant_user_id", participantUserId).maybeSingle();
  return data ? sessionFromRow(data, await loadEvaluations(data.id, data.participant_user_id ?? "")) : null;
}

export async function getSession(id: string): Promise<SessionState | null> {
  if (!dbEnabled) {
    const s = memSessions.get(id);
    return s ? sessionFromRow(s.row, await loadEvaluations(id, s.row.participant_user_id ?? "")) : null;
  }
  const { data } = await db().from("assessment_sessions").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return sessionFromRow(data, await loadEvaluations(id, data.participant_user_id ?? ""));
}

/** Find the session for an employee in a batch, if one exists. */
async function findSessionRow(seed: SessionSeed): Promise<any | null> {
  if (!dbEnabled) {
    // Prefer the participant account link (one active session per participant),
    // else fall back to the name + department + batch identity.
    if (seed.participantUserId) {
      for (const { row } of memSessions.values()) if (row.participant_user_id === seed.participantUserId) return row;
    }
    for (const { row } of memSessions.values()) {
      if (row.employee_name === seed.employeeName && row.department_id === seed.departmentId && row.batch === seed.batch) return row;
    }
    return null;
  }
  if (seed.participantUserId) {
    const { data } = await db().from("assessment_sessions").select("*").eq("participant_user_id", seed.participantUserId).maybeSingle();
    if (data) return data;
  }
  const { data } = await db()
    .from("assessment_sessions")
    .select("*")
    .eq("employee_name", seed.employeeName)
    .eq("department_id", seed.departmentId)
    .eq("batch", seed.batch)
    .maybeSingle();
  return data ?? null;
}

/** READ-ONLY lookup for a candidate + batch — never creates. Opening a page must
 *  not bring back an assessment an admin deleted; only a real write may do that. */
export async function findSession(seed: SessionSeed): Promise<SessionState | null> {
  const row = await findSessionRow(seed);
  if (!row) return null;
  return sessionFromRow(row, await loadEvaluations(row.id, row.participant_user_id ?? ""));
}

/** Find-or-create the session for a candidate + batch. */
export async function getOrCreateSession(seed: SessionSeed, createdBy: string | null): Promise<SessionState> {
  const existing = await findSessionRow(seed);
  if (existing) {
    // Fill any empty identity fields from a richer seed — e.g. a peer opened the
    // session first (minimal identity), then HC selects the same participant and
    // provides golongan/batch/nik. Never overwrites values already set.
    const patch: any = {};
    if (seed.participantUserId && !existing.participant_user_id) patch.participant_user_id = seed.participantUserId;
    if (seed.batch && !existing.batch) patch.batch = seed.batch;
    if (seed.nik && !existing.nik) patch.nik = seed.nik;
    if (seed.jabatan && !existing.jabatan) patch.jabatan = seed.jabatan;
    if (seed.golongan && !existing.golongan) patch.golongan = seed.golongan;
    if (seed.golonganTujuan && !existing.golongan_tujuan) patch.golongan_tujuan = seed.golonganTujuan;
    if (seed.departmentName && !existing.department_name) patch.department_name = seed.departmentName;
    if (Object.keys(patch).length) {
      Object.assign(existing, patch);
      if (!dbEnabled) {
        const mem = memSessions.get(existing.id);
        if (mem) mem.row = { ...mem.row, ...patch };
      } else {
        await db().from("assessment_sessions").update(patch).eq("id", existing.id);
      }
    }
    return sessionFromRow(existing, await loadEvaluations(existing.id, existing.participant_user_id ?? ""));
  }

  const id = newId();
  const row = {
    id,
    batch: seed.batch,
    nik: seed.nik,
    participant_user_id: seed.participantUserId ?? null,
    employee_name: seed.employeeName,
    jabatan: seed.jabatan,
    department_id: seed.departmentId,
    department_name: seed.departmentName,
    golongan: seed.golongan,
    golongan_tujuan: seed.golonganTujuan,
    director_only: seed.directorOnly,
    self_scores: {},
    financial_impact: false,
    iv_note: "",
    status: "proses",
    created_by: createdBy,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  if (!dbEnabled) {
    memSessions.set(id, { row, evals: new Map() });
  } else {
    const { error } = await db().from("assessment_sessions").insert(row);
    if (error) {
      // The DB guard refuses to resurrect an assessment the admin deleted.
      if ((error.message || "").includes("ASSESSMENT_BLOCKED")) {
        throw new Error(
          "Assessment karyawan ini sudah dihapus admin. Aktifkan ulang di Pengaturan Assessment untuk menilai dari awal.",
        );
      }
      throw new Error(error.message);
    }
  }
  // Brand-new session: no evaluations yet, but report the expected peer panel
  // size so the dashboard shows "0/N" immediately.
  return sessionFromRow(row, { evals: [], peerSubmitted: 0, peerExpected: await expectedPeerCount(row.participant_user_id ?? "") });
}

export async function listSessions(): Promise<SessionState[]> {
  if (!dbEnabled) {
    return Promise.all([...memSessions.keys()].map((id) => getSession(id))).then((xs) =>
      xs.filter((s): s is SessionState => !!s),
    );
  }
  const { data } = await db().from("assessment_sessions").select("*").order("updated_at", { ascending: false });
  const rows = data ?? [];
  const withEvals = await Promise.all(rows.map(async (r) => sessionFromRow(r, await loadEvaluations(r.id, r.participant_user_id ?? ""))));
  return withEvals;
}

/* ---------------- writes ---------------- */

export interface EvaluationInput {
  sessionId: string;
  evaluatorKey: EvaluatorKey;
  evaluatorUserId: string | null;
  scores?: ParamScores;
  note?: string;
  interview?: DimensionScores;
  ivVote?: IvRecValue | null;
  submitted?: boolean;
}

/** Upsert one evaluator's row. `submitted` marks it final (independent of others). */
export async function saveEvaluation(input: EvaluationInput): Promise<EvaluationState> {
  const patch: any = { updated_at: nowIso() };
  if (input.scores !== undefined) patch.scores = input.scores;
  if (input.note !== undefined) patch.note = input.note;
  if (input.interview !== undefined) patch.interview = input.interview;
  if (input.ivVote !== undefined) patch.iv_vote = input.ivVote;
  if (input.submitted !== undefined) {
    patch.submitted = input.submitted;
    patch.submitted_at = input.submitted ? nowIso() : null;
  }

  if (!dbEnabled) {
    const s = memSessions.get(input.sessionId);
    if (!s) throw new Error("Sesi tidak ditemukan");
    const prev = s.evals.get(input.evaluatorKey) ?? {
      id: newId(),
      session_id: input.sessionId,
      evaluator_key: input.evaluatorKey,
      evaluator_user_id: input.evaluatorUserId,
      scores: {},
      note: "",
      interview: {},
      iv_vote: null,
      submitted: false,
      submitted_at: null,
    };
    const merged = { ...prev, ...patch, evaluator_user_id: input.evaluatorUserId ?? prev.evaluator_user_id };
    s.evals.set(input.evaluatorKey, merged);
    s.row.updated_at = nowIso();
    return evaluationFromRow(merged);
  }

  const { data } = await db()
    .from("assessment_evaluations")
    .upsert(
      {
        session_id: input.sessionId,
        evaluator_key: input.evaluatorKey,
        evaluator_user_id: input.evaluatorUserId,
        ...patch,
      },
      { onConflict: "session_id,evaluator_key" },
    )
    .select()
    .single();
  await db().from("assessment_sessions").update({ updated_at: nowIso() }).eq("id", input.sessionId);
  return evaluationFromRow(data);
}

/** Update session-level (shared) fields: self-assessment, interview note, etc. */
export async function updateSessionMeta(
  sessionId: string,
  patch: Partial<{ selfScores: ParamScores; financialImpact: boolean; ivNote: string; status: string; golongan: string; golonganTujuan: string; batch: string; nik: string }>,
): Promise<void> {
  const row: any = { updated_at: nowIso() };
  if (patch.selfScores !== undefined) row.self_scores = patch.selfScores;
  if (patch.financialImpact !== undefined) row.financial_impact = patch.financialImpact;
  if (patch.ivNote !== undefined) row.iv_note = patch.ivNote;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.golongan !== undefined) row.golongan = patch.golongan;
  if (patch.golonganTujuan !== undefined) row.golongan_tujuan = patch.golonganTujuan;
  if (patch.batch !== undefined) row.batch = patch.batch;
  if (patch.nik !== undefined) row.nik = patch.nik;

  if (!dbEnabled) {
    const s = memSessions.get(sessionId);
    if (s) s.row = { ...s.row, ...row };
    return;
  }
  await db().from("assessment_sessions").update(row).eq("id", sessionId);
}

/** Delete a session with its evaluations (FK cascade) and peer reviews (no FK,
 *  so removed explicitly — otherwise orphan rows pile up). Shared DB, so the
 *  removal is visible to every user on their next poll. Errors are RETURNED,
 *  never swallowed: a silent failure looked exactly like "it came back". */
export async function deleteSession(id: string): Promise<{ error?: string }> {
  if (!dbEnabled) {
    memSessions.delete(id);
    return {};
  }
  // Remember WHO this was, then block re-creation. A database trigger enforces
  // the block, so no client — not even a stale tab still running an older build
  // — can bring the assessment back on its own.
  const { data: row } = await db()
    .from("assessment_sessions")
    .select("participant_user_id,employee_name")
    .eq("id", id)
    .maybeSingle();

  // Peer reviews first — they reference the session but without a cascade.
  await db().from("assessment_peer_reviews").delete().eq("session_id", id);
  const { error } = await db().from("assessment_sessions").delete().eq("id", id);
  if (error) return { error: error.message };

  if (row) {
    await db().from("assessment_blocked").upsert({
      participant_user_id: row.participant_user_id || `name:${row.employee_name}`,
      employee_name: row.employee_name ?? null,
      blocked_at: nowIso(),
    });
  }
  // Verify it is really gone (a blocked delete reports no error but leaves the row).
  const { data } = await db().from("assessment_sessions").select("id").eq("id", id).maybeSingle();
  return data ? { error: "Baris masih ada setelah dihapus — periksa hak akses database." } : {};
}

/** Participant ids whose assessment was deleted and is awaiting a fresh start. */
export async function listBlockedParticipants(): Promise<string[]> {
  if (!dbEnabled) return [];
  const { data } = await db().from("assessment_blocked").select("participant_user_id");
  return ((data ?? []) as { participant_user_id: string }[]).map((r) => r.participant_user_id);
}

/** Admin re-opens assessment for a participant (start over from zero). */
export async function unblockParticipant(participantUserId: string, employeeName?: string | null): Promise<void> {
  if (!dbEnabled) return;
  await db().from("assessment_blocked").delete().eq("participant_user_id", participantUserId);
  if (employeeName) await db().from("assessment_blocked").delete().eq("employee_name", employeeName);
}

/** Test/seed helper (demo mode only): register an evaluator identity. */
export function _memRegisterEvaluator(id: EvaluatorIdentity) {
  memEvaluators.set(id.userId, id);
}
