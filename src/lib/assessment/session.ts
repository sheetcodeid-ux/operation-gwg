/**
 * Server-backed assessment session — shared shapes (safe to import anywhere).
 *
 * A "session" is one grade-promotion assessment for a single employee in a
 * batch. Each official evaluator (Atasan / HC / Director) owns ONE evaluation
 * row they submit independently — nobody waits for the others. Cross-device
 * progress is read back through server actions (the browser never touches the
 * DB directly; all access is server-mediated with the service-role key).
 */

import type { DimensionScores, EvaluatorKey, IvRecValue, ParamScores } from "./config";

/** A login mapped to their evaluator identity + scope. `scopeDepartmentId`
 *  is "" for Director/HC (every employee) or a department id for a Head. */
export interface EvaluatorIdentity {
  userId: string;
  evaluatorKey: EvaluatorKey;
  scopeDepartmentId: string;
  displayName: string;
}

/** One evaluator's independently-submitted contribution to a session. */
export interface EvaluationState {
  evaluatorKey: EvaluatorKey;
  evaluatorUserId: string | null;
  scores: ParamScores;
  note: string;
  interview: DimensionScores;
  ivVote: IvRecValue | null;
  submitted: boolean;
  submittedAt: string | null;
  updatedAt: string;
}

/** The full live state of one employee's assessment, aggregated across evaluators. */
export interface SessionState {
  id: string;
  batch: string;
  nik: string;
  /** Participant's User Management account id (links assignments → session). */
  participantUserId: string;
  employeeName: string;
  jabatan: string;
  departmentId: string;
  departmentName: string;
  golongan: string;
  golonganTujuan: string;
  directorOnly: boolean;
  selfScores: ParamScores;
  financialImpact: boolean;
  ivNote: string;
  status: string;
  evaluations: EvaluationState[];
  /** Rekan Sejawat (Penilai 3) panel progress: how many assigned peers have
   *  submitted vs how many are expected (drives the "1/5" progress display). */
  peerSubmitted: number;
  peerExpected: number;
  createdBy: string | null;
  updatedAt: string;
}

/** Identity + candidate fields needed to open (find-or-create) a session. */
export interface SessionSeed {
  batch: string;
  nik: string;
  /** Participant's User Management account id, when the candidate is an account. */
  participantUserId?: string;
  employeeName: string;
  jabatan: string;
  departmentId: string;
  departmentName: string;
  golongan: string;
  golonganTujuan: string;
  directorOnly: boolean;
}
