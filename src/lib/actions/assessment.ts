"use server";

import { getSessionUser } from "@/lib/auth";
import {
  deleteSession as dbDeleteSession,
  findSession,
  getOrCreateSession,
  getSession,
  listSessions,
  saveEvaluation,
  updateSessionMeta,
} from "@/lib/data/assessment";
import { resolveEvaluatorFromRoster as resolveEvaluator, resolveEvaluatorsFromRoster } from "@/lib/data/assessment-roster";
import { getUser } from "@/lib/data/store";
import { orgDepartmentId } from "@/lib/assessment/org";
import type { EvaluatorIdentity, SessionSeed, SessionState } from "@/lib/assessment/session";
import type { DimensionScores, EvaluatorKey, IvRecValue, ParamScores } from "@/lib/assessment/config";

/** Resolve the signed-in user's evaluator identity (null if they aren't one). */
export async function getMyEvaluator(): Promise<EvaluatorIdentity | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return resolveEvaluator(user.id);
}

/** EVERY evaluator hat the signed-in user wears (HC who also heads a division
 *  gets both `hc` and `al`). Scope falls back to their own department. */
export async function getMyEvaluators(): Promise<EvaluatorIdentity[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const list = await resolveEvaluatorsFromRoster(user.id);
  const myDept = getUser(user.id)?.department ?? null;
  return list.map((e) =>
    e.evaluatorKey === "al" && !e.scopeDepartmentId && myDept
      ? { ...e, scopeDepartmentId: orgDepartmentId(myDept) }
      : e,
  );
}

/**
 * Look up the assessment session for a candidate + batch — READ ONLY.
 *
 * This used to find-or-create, which meant simply *viewing* the page re-created
 * a session an admin had just deleted (it kept coming back on its own). A
 * session is now born only from a real write: an evaluator submitting a score,
 * a participant saving their Self Assessment, or a peer review.
 */
export async function openSession(seed: SessionSeed): Promise<SessionState | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return findSession(seed);
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
  /** Existing session; empty when this is the first score for the candidate — in
   *  that case `seed` is used to create it (creation happens ONLY on a write). */
  sessionId: string;
  seed?: SessionSeed;
  /** Which of MY columns to write (dual-role accounts have more than one). It is
   *  always validated against the caller's own identities — never trusted. */
  evaluatorKey?: EvaluatorKey;
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
  const mine = await getMyEvaluators();
  if (mine.length === 0) return { ok: false, error: "Akun ini bukan penilai resmi." };
  // Write the requested column only if the caller actually owns it.
  const me = input.evaluatorKey ? mine.find((e) => e.evaluatorKey === input.evaluatorKey) : mine[0];
  if (!me) return { ok: false, error: "Anda tidak berhak mengisi kolom penilai ini." };

  // Saving a score is the deliberate act that OPENS an assessment: create the
  // session here when it doesn't exist yet (e.g. the first evaluator, or an
  // assessment being redone after an admin deleted it).
  let session = input.sessionId ? await getSession(input.sessionId) : null;
  if (!session && input.seed) session = await getOrCreateSession(input.seed, user.id);
  if (!session) return { ok: false, error: "Sesi assessment tidak ditemukan." };

  // Head (Atasan) is scoped to their own division.
  if (me.scopeDepartmentId && me.scopeDepartmentId !== session.departmentId) {
    return { ok: false, error: "Karyawan ini di luar divisi Anda." };
  }

  await saveEvaluation({
    sessionId: session.id,
    evaluatorKey: me.evaluatorKey,
    evaluatorUserId: me.userId,
    scores: input.scores,
    note: input.note,
    interview: input.interview,
    ivVote: input.ivVote,
    submitted: input.submitted,
  });

  const fresh = await getSession(session.id);
  return fresh ? { ok: true, session: fresh } : { ok: false, error: "Gagal memuat ulang sesi." };
}

/** Admin-only: delete a session (and its evaluations) from the shared DB — the
 *  removal propagates to every user on their next dashboard poll. */
export async function deleteSession(sessionId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Tidak ada sesi login." };
  if (user.role !== "super_admin") return { ok: false, error: "Hanya admin yang dapat menghapus assessment." };
  const res = await dbDeleteSession(sessionId);
  if (res.error) return { ok: false, error: res.error };
  return { ok: true };
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
