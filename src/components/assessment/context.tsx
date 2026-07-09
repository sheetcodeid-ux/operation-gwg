"use client";

import * as React from "react";
import {
  emptyEvaluatorScores,
  evaluatorFilled,
  evaluatorsFor,
  PARAMETERS,
  resolveInterviewRec,
  type DimensionKey,
  type DimensionScores,
  type Evaluator,
  type EvaluatorKey,
  type EvaluatorScores,
  type IvRecValue,
  type ParamKey,
  type ParamScores,
} from "@/lib/assessment/config";
import { formatGolongan, getDepartment, getEmployee, getPosition } from "@/lib/assessment/org";
import type { AssessmentRole, TabKey } from "@/lib/assessment/access";
import { canSeeTab, TAB_ACCESS } from "@/lib/assessment/access";
import type { EvaluatorIdentity, SessionSeed, SessionState } from "@/lib/assessment/session";
import { openSession, submitMyEvaluation, updateSessionShared } from "@/lib/actions/assessment";

/** Cascading identity: department → position → employee, plus the manual fields. */
export interface Candidate {
  departmentId: string;
  positionId: string;
  employeeId: string;
  nik: string;
  golongan: string;
  golonganLevel: string;
  golonganTujuan: string;
  golonganTujuanLevel: string;
  batch: string;
}

const EMPTY_CANDIDATE: Candidate = {
  departmentId: "",
  positionId: "",
  employeeId: "",
  nik: "",
  golongan: "",
  golonganLevel: "",
  golonganTujuan: "",
  golonganTujuanLevel: "",
  batch: "",
};

export interface ResolvedCandidate {
  nama: string;
  jabatan: string;
  departemen: string;
  isHead: boolean;
}

interface AssessmentState {
  role: AssessmentRole;
  setRole: (r: AssessmentRole) => void;
  /** True only for Super Admin — controls whether the viewpoint switcher shows. */
  canSwitchRole: boolean;
  /** Show built-in sample data (demo mode). False in production (DB live) so the
   *  dashboard shows only real sessions. */
  showSample: boolean;
  /** The signed-in user's evaluator identity (al/hc/dir), or null if not an evaluator. */
  evaluator: EvaluatorIdentity | null;
  /** Live server-backed session for the selected candidate (evaluator flow). */
  session: SessionState | null;
  sessionBusy: boolean;
  /** Submit/save the signed-in evaluator's own column — independent of the others. */
  submitMine: (patch: {
    scores?: ParamScores;
    note?: string;
    interview?: DimensionScores;
    ivVote?: IvRecValue | null;
    submitted?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;

  tab: TabKey;
  setTab: (t: TabKey) => void;
  visited: Set<TabKey>;
  /** True only right after button-driven navigation (Simpan & Lanjut / Selesai). */
  entrance: boolean;

  candidate: Candidate;
  resolved: ResolvedCandidate;
  setDepartment: (id: string) => void;
  setPosition: (id: string) => void;
  setEmployee: (id: string) => void;
  patchCandidate: (patch: Partial<Candidate>) => void;
  identityComplete: boolean;

  /** Official evaluators for the selected position (3, or Director-only). */
  activeEvaluators: Evaluator[];
  /** Every active evaluator has scored all six parameters. */
  penilaianComplete: boolean;
  continueToInterview: () => void;
  finishInterview: () => void;

  syarat: Record<number, boolean>;
  toggleSyarat: (id: number, v: boolean) => void;
  syaratPassed: boolean;

  self: ParamScores;
  pickSelf: (key: ParamKey, value: number) => void;
  selfComplete: boolean;

  /** All prerequisites (spec §2) met → show "Simpan & Lanjut ke Penilaian". */
  readyForPenilaian: boolean;
  saved: boolean;
  saveAndContinue: () => void;

  scores: EvaluatorScores;
  pickScore: (evaluator: EvaluatorKey, key: ParamKey, value: number) => void;

  interview: DimensionScores;
  pickDimension: (key: DimensionKey, value: number) => void;
  ivNote: string;
  setIvNote: (v: string) => void;
  /** Interview recommendation vote per official evaluator (Atasan/HC/Director). */
  ivVotes: Partial<Record<EvaluatorKey, IvRecValue>>;
  setIvVote: (evaluator: EvaluatorKey, value: IvRecValue) => void;
  /** Final interview recommendation = majority of the votes (derived). */
  ivRecommendation: IvRecValue | null;

  /** Optional qualitative note per evaluator, shown on the dashboard. */
  evaluatorNotes: Partial<Record<EvaluatorKey, string>>;
  setEvaluatorNote: (key: EvaluatorKey, note: string) => void;

  financialImpact: boolean;
  setFinancialImpact: (v: boolean) => void;

  /** Clear all captured data and start over. */
  resetAssessment: () => void;
}

const STORAGE_KEY = "gwg-assessment-draft";

const Ctx = React.createContext<AssessmentState | null>(null);

export function useAssessment(): AssessmentState {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useAssessment must be used inside <AssessmentProvider>");
  return ctx;
}

export function AssessmentProvider({
  children,
  initialRole = "director",
  canSwitchRole = true,
  evaluator = null,
  showSample = true,
}: {
  children: React.ReactNode;
  initialRole?: AssessmentRole;
  canSwitchRole?: boolean;
  evaluator?: EvaluatorIdentity | null;
  showSample?: boolean;
}) {
  const [role, setRoleState] = React.useState<AssessmentRole>(initialRole);
  const [tab, setTabState] = React.useState<TabKey>("panduan");
  const [visited, setVisited] = React.useState<Set<TabKey>>(new Set<TabKey>(["panduan"]));
  const [entrance, setEntrance] = React.useState(false); // true only for button-driven navigation

  const [candidate, setCandidate] = React.useState<Candidate>({ ...EMPTY_CANDIDATE });
  const [syarat, setSyarat] = React.useState<Record<number, boolean>>({ 1: false, 2: false, 3: false });
  const [self, setSelf] = React.useState<ParamScores>({});
  const [saved, setSaved] = React.useState(false);
  const [scores, setScores] = React.useState<EvaluatorScores>(emptyEvaluatorScores());
  const [interview, setInterview] = React.useState<DimensionScores>({});
  const [ivNote, setIvNote] = React.useState("");
  const [ivVotes, setIvVotes] = React.useState<Partial<Record<EvaluatorKey, IvRecValue>>>({});
  const setIvVote = React.useCallback((evaluator: EvaluatorKey, value: IvRecValue) => setIvVotes((v) => ({ ...v, [evaluator]: value })), []);
  const [evaluatorNotes, setEvaluatorNotes] = React.useState<Partial<Record<EvaluatorKey, string>>>({});
  const [financialImpact, setFinancialImpact] = React.useState(false);
  const setEvaluatorNote = React.useCallback((key: EvaluatorKey, note: string) => setEvaluatorNotes((n) => ({ ...n, [key]: note })), []);

  // ── server-backed session (evaluator flow): each evaluator submits their own
  //    column independently; progress from other devices is polled back in. ──
  const [session, setSession] = React.useState<SessionState | null>(null);
  const [sessionBusy, setSessionBusy] = React.useState(false);

  // ── draft persistence: survive a refresh (frontend-only, no backend yet) ──
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.candidate) setCandidate({ ...EMPTY_CANDIDATE, ...d.candidate });
        if (d.syarat) setSyarat(d.syarat);
        if (d.self) setSelf(d.self);
        if (d.scores) setScores(d.scores);
        if (d.interview) setInterview(d.interview);
        if (typeof d.ivNote === "string") setIvNote(d.ivNote);
        if (d.ivVotes) setIvVotes(d.ivVotes);
        if (d.evaluatorNotes) setEvaluatorNotes(d.evaluatorNotes);
        if (typeof d.financialImpact === "boolean") setFinancialImpact(d.financialImpact);
      }
    } catch {}
    setHydrated(true);
  }, []);
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ candidate, syarat, self, scores, interview, ivNote, ivVotes, evaluatorNotes, financialImpact }),
      );
    } catch {}
  }, [hydrated, candidate, syarat, self, scores, interview, ivNote, ivVotes, evaluatorNotes, financialImpact]);

  const resetAssessment = React.useCallback(() => {
    setCandidate({ ...EMPTY_CANDIDATE });
    setSyarat({ 1: false, 2: false, 3: false });
    setSelf({});
    setScores(emptyEvaluatorScores());
    setInterview({});
    setIvNote("");
    setIvVotes({});
    setEvaluatorNotes({});
    setFinancialImpact(false);
    setSaved(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setTabState("syarat");
  }, []);

  // Tab click (manual browsing): switch instantly, no entrance animation/scroll.
  const setTab = React.useCallback((t: TabKey) => {
    setEntrance(false);
    setTabState(t);
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)));
  }, []);

  // Button-driven step (Simpan & Lanjut / Selesai): animate up + scroll to top so
  // the user lands at the next page's header without scrolling manually.
  const flowTo = React.useCallback((t: TabKey) => {
    setEntrance(true);
    setTabState(t);
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)));
  }, []);

  const setRole = React.useCallback(
    (r: AssessmentRole) => {
      if (!canSwitchRole) return; // non-admin viewpoints are fixed to the login identity
      setRoleState(r);
      // Keep the current tab only if the new role may see it; else jump to its first tab.
      setTabState((cur) => (canSeeTab(r, cur) ? cur : TAB_ACCESS[r][0]));
    },
    [canSwitchRole],
  );

  // Cascading resets: changing a parent clears its descendants (spec §8).
  const setDepartment = React.useCallback(
    (id: string) => setCandidate((c) => ({ ...c, departmentId: id, positionId: "", employeeId: "" })),
    [],
  );
  const setPosition = React.useCallback(
    (id: string) => setCandidate((c) => ({ ...c, positionId: id, employeeId: "" })),
    [],
  );
  const setEmployee = React.useCallback((id: string) => setCandidate((c) => ({ ...c, employeeId: id })), []);
  const patchCandidate = React.useCallback((patch: Partial<Candidate>) => setCandidate((c) => ({ ...c, ...patch })), []);

  const toggleSyarat = React.useCallback((id: number, v: boolean) => setSyarat((s) => ({ ...s, [id]: v })), []);
  const pickSelf = React.useCallback((key: ParamKey, value: number) => setSelf((s) => ({ ...s, [key]: value })), []);
  const pickScore = React.useCallback(
    (evaluator: EvaluatorKey, key: ParamKey, value: number) =>
      setScores((s) => ({ ...s, [evaluator]: { ...s[evaluator], [key]: value } })),
    [],
  );
  const pickDimension = React.useCallback((key: DimensionKey, value: number) => setInterview((s) => ({ ...s, [key]: value })), []);

  const resolved: ResolvedCandidate = React.useMemo(() => {
    const pos = getPosition(candidate.positionId);
    return {
      nama: getEmployee(candidate.employeeId)?.name ?? "",
      jabatan: pos?.title ?? "",
      departemen: getDepartment(candidate.departmentId)?.name ?? "",
      isHead: pos?.isHead ?? false,
    };
  }, [candidate.departmentId, candidate.positionId, candidate.employeeId]);

  const activeEvaluators = React.useMemo(
    () => evaluatorsFor(resolved.jabatan ? { isHead: resolved.isHead, title: resolved.jabatan } : null),
    [resolved.jabatan, resolved.isHead],
  );
  const penilaianComplete = activeEvaluators.every((e) => evaluatorFilled(scores[e.key]) === PARAMETERS.length);
  // Final interview recommendation = majority vote across the active evaluators.
  const ivRecommendation = React.useMemo(
    () => resolveInterviewRec(activeEvaluators.map((e) => ivVotes[e.key]).filter((v): v is IvRecValue => !!v)),
    [activeEvaluators, ivVotes],
  );
  const continueToInterview = React.useCallback(() => flowTo("interview"), [flowTo]);
  const finishInterview = React.useCallback(() => flowTo("dashboard"), [flowTo]);

  const identityComplete =
    !!candidate.departmentId &&
    !!candidate.positionId &&
    !!candidate.employeeId &&
    candidate.nik.trim().length > 0 &&
    !!candidate.golongan &&
    !!candidate.golonganTujuan &&
    !!candidate.batch;

  const syaratPassed = syarat[1] && syarat[2] && syarat[3];
  const selfComplete = PARAMETERS.every((p) => !!self[p.key]);
  const readyForPenilaian =
    syaratPassed && identityComplete && selfComplete && visited.has("panduan") && visited.has("referensi");

  // Open (find-or-create) the server session once a logged-in evaluator has a
  // full candidate selected, then poll so other evaluators' progress shows up.
  const seedKey = evaluator
    ? [candidate.departmentId, resolved.nama, candidate.batch].join("|")
    : "";
  React.useEffect(() => {
    if (!evaluator || !identityComplete || !resolved.nama) {
      setSession(null);
      return;
    }
    let cancelled = false;
    const seed: SessionSeed = {
      batch: candidate.batch,
      nik: candidate.nik,
      employeeName: resolved.nama,
      jabatan: resolved.jabatan,
      departmentId: candidate.departmentId,
      departmentName: resolved.departemen,
      golongan: formatGolongan(candidate.golongan, candidate.golonganLevel) || candidate.golongan,
      golonganTujuan: formatGolongan(candidate.golonganTujuan, candidate.golonganTujuanLevel) || candidate.golonganTujuan,
      directorOnly: activeEvaluators.length === 1,
    };
    setSessionBusy(true);
    openSession(seed)
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .finally(() => {
        if (!cancelled) setSessionBusy(false);
      });
    // Poll for cross-device updates every 5s.
    const poll = setInterval(async () => {
      const cur = await openSession(seed).catch(() => null);
      if (!cancelled && cur) setSession(cur);
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey, identityComplete]);

  const submitMine = React.useCallback(
    async (patch: {
      scores?: ParamScores;
      note?: string;
      interview?: DimensionScores;
      ivVote?: IvRecValue | null;
      submitted?: boolean;
    }): Promise<{ ok: boolean; error?: string }> => {
      if (!evaluator) return { ok: false, error: "Akun ini bukan penilai resmi." };
      if (!session) return { ok: false, error: "Sesi assessment belum siap. Lengkapi identitas karyawan dulu." };
      setSessionBusy(true);
      try {
        const res = await submitMyEvaluation({ sessionId: session.id, ...patch });
        if (res.ok) {
          // Also persist the shared session fields (self-assessment, interview
          // note, fast-track) so the dashboard reflects the full picture.
          const shared = await updateSessionShared(session.id, {
            selfScores: self,
            ivNote,
            financialImpact,
          }).catch(() => null);
          setSession(shared ?? res.session);
          return { ok: true };
        }
        return { ok: false, error: res.error };
      } catch {
        return { ok: false, error: "Gagal menyimpan ke server." };
      } finally {
        setSessionBusy(false);
      }
    },
    [evaluator, session, self, ivNote, financialImpact],
  );

  const saveAndContinue = React.useCallback(() => {
    setSaved(true);
    // Karyawan may not access Penilaian (spec §3) — only advance when allowed.
    if (canSeeTab(role, "penilaian")) flowTo("penilaian");
  }, [role, flowTo]);

  const value: AssessmentState = {
    role,
    setRole,
    canSwitchRole,
    showSample,
    evaluator,
    session,
    sessionBusy,
    submitMine,
    tab,
    setTab,
    visited,
    entrance,
    candidate,
    resolved,
    setDepartment,
    setPosition,
    setEmployee,
    patchCandidate,
    identityComplete,
    activeEvaluators,
    penilaianComplete,
    continueToInterview,
    finishInterview,
    syarat,
    toggleSyarat,
    syaratPassed,
    self,
    pickSelf,
    selfComplete,
    readyForPenilaian,
    saved,
    saveAndContinue,
    scores,
    pickScore,
    interview,
    pickDimension,
    ivNote,
    setIvNote,
    ivVotes,
    setIvVote,
    ivRecommendation,
    evaluatorNotes,
    setEvaluatorNote,
    financialImpact,
    setFinancialImpact,
    resetAssessment,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
