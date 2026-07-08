"use server";

import { getSessionUser } from "@/lib/auth";
import {
  getOrCreateSession,
  getSession,
  listSessions,
  resolveEvaluator,
  saveEvaluation,
  updateSessionMeta,
} from "@/lib/data/assessment";
import type { EvaluatorIdentity, SessionSeed, SessionState } from "@/lib/assessment/session";
import type { DimensionScores, IvRecValue, ParamScores } from "@/lib/assessment/config";

/** Resolve the signed-in user's evaluator identity (null if they aren't one). */
export async function getMyEvaluator(): Promise<EvaluatorIdentity | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return resolveEvaluator(user.id);
}

/** Open (find-or-create) the assessment session for a candidate + batch. */
export async function openSession(seed: SessionSeed): Promise<SessionState | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return getOrCreateSession(seed, user.id);
}

/** Re-read a session — used for cross-device polling. */
export async function fetchSession(sessionId: string): Promise<SessionState | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return getSession(sessionId);
}

/** List every session (dashboard). */
export async function listAllSessions(): Promise<SessionState[]> {
  const user = await getSessionUser();
  if (!user) return [];
  return listSessions();
}

export interface SubmitInput {
  sessionId: string;
  scores?: ParamScores;
  note?: string;
  interview?: DimensionScores;
  ivVote?: IvRecValue | null;
  /** true = final submit (independent of the other evaluators); false = save draft. */
  submitted?: boolean;
}

/**
 * Save the CALLER's own evaluation row. The evaluator column (al/hc/dir) is
 * taken from the signed-in identity — never from the client — and a Head may
 * only write to a session inside their own division.
 */
export async function submitMyEvaluation(
  input: SubmitInput,
): Promise<{ ok: true; session: SessionState } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Tidak ada sesi login." };
  const me = await resolveEvaluator(user.id);
  if (!me) return { ok: false, error: "Akun ini bukan penilai resmi." };

  const session = await getSession(input.sessionId);
  if (!session) return { ok: false, error: "Sesi assessment tidak ditemukan." };

  // Head (Atasan) is scoped to their own division.
  if (me.scopeDepartmentId && me.scopeDepartmentId !== session.departmentId) {
    return { ok: false, error: "Karyawan ini di luar divisi Anda." };
  }

  await saveEvaluation({
    sessionId: input.sessionId,
    evaluatorKey: me.evaluatorKey,
    evaluatorUserId: me.userId,
    scores: input.scores,
    note: input.note,
    interview: input.interview,
    ivVote: input.ivVote,
    submitted: input.submitted,
  });

  const fresh = await getSession(input.sessionId);
  return fresh ? { ok: true, session: fresh } : { ok: false, error: "Gagal memuat ulang sesi." };
}

/** Update shared session fields (self-assessment, interview note, financial impact, status). */
export async function updateSessionShared(
  sessionId: string,
  patch: Partial<{ selfScores: ParamScores; financialImpact: boolean; ivNote: string; status: string }>,
): Promise<SessionState | null> {
  const user = await getSessionUser();
  if (!user) return null;
  await updateSessionMeta(sessionId, patch);
  return getSession(sessionId);
}
