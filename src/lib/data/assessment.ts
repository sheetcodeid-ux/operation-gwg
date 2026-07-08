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

const sessionFromRow = (r: any, evals: EvaluationState[]): SessionState => ({
  id: r.id,
  batch: r.batch ?? "",
  nik: r.nik ?? "",
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
  evaluations: evals,
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

async function loadEvaluations(sessionId: string): Promise<EvaluationState[]> {
  if (!dbEnabled) {
    const s = memSessions.get(sessionId);
    return s ? [...s.evals.values()].map(evaluationFromRow) : [];
  }
  const { data } = await db()
    .from("assessment_evaluations")
    .select("*")
    .eq("session_id", sessionId);
  return (data ?? []).map(evaluationFromRow);
}

export async function getSession(id: string): Promise<SessionState | null> {
  if (!dbEnabled) {
    const s = memSessions.get(id);
    return s ? sessionFromRow(s.row, await loadEvaluations(id)) : null;
  }
  const { data } = await db().from("assessment_sessions").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return sessionFromRow(data, await loadEvaluations(id));
}

/** Find the session for an employee in a batch, if one exists. */
async function findSessionRow(seed: SessionSeed): Promise<any | null> {
  if (!dbEnabled) {
    for (const { row } of memSessions.values()) {
      if (
        row.employee_name === seed.employeeName &&
        row.department_id === seed.departmentId &&
        row.batch === seed.batch
      )
        return row;
    }
    return null;
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

/** Find-or-create the session for a candidate + batch. */
export async function getOrCreateSession(seed: SessionSeed, createdBy: string | null): Promise<SessionState> {
  const existing = await findSessionRow(seed);
  if (existing) return sessionFromRow(existing, await loadEvaluations(existing.id));

  const id = newId();
  const row = {
    id,
    batch: seed.batch,
    nik: seed.nik,
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
    await db().from("assessment_sessions").insert(row);
  }
  return sessionFromRow(row, []);
}

export async function listSessions(): Promise<SessionState[]> {
  if (!dbEnabled) {
    return Promise.all([...memSessions.keys()].map((id) => getSession(id))).then((xs) =>
      xs.filter((s): s is SessionState => !!s),
    );
  }
  const { data } = await db().from("assessment_sessions").select("*").order("updated_at", { ascending: false });
  const rows = data ?? [];
  const withEvals = await Promise.all(rows.map(async (r) => sessionFromRow(r, await loadEvaluations(r.id))));
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
  patch: Partial<{ selfScores: ParamScores; financialImpact: boolean; ivNote: string; status: string }>,
): Promise<void> {
  const row: any = { updated_at: nowIso() };
  if (patch.selfScores !== undefined) row.self_scores = patch.selfScores;
  if (patch.financialImpact !== undefined) row.financial_impact = patch.financialImpact;
  if (patch.ivNote !== undefined) row.iv_note = patch.ivNote;
  if (patch.status !== undefined) row.status = patch.status;

  if (!dbEnabled) {
    const s = memSessions.get(sessionId);
    if (s) s.row = { ...s.row, ...row };
    return;
  }
  await db().from("assessment_sessions").update(row).eq("id", sessionId);
}

/** Test/seed helper (demo mode only): register an evaluator identity. */
export function _memRegisterEvaluator(id: EvaluatorIdentity) {
  memEvaluators.set(id.userId, id);
}
