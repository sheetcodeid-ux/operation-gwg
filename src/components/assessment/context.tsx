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
import { BATCHES, formatGolongan, getDepartment, getEmployee, getPosition, orgDepartmentId, orgPositionId } from "@/lib/assessment/org";
import type { AssessmentRole, TabKey } from "@/lib/assessment/access";
import { canSeeTab, TAB_ACCESS } from "@/lib/assessment/access";
import type { EvaluatorIdentity, SessionSeed, SessionState } from "@/lib/assessment/session";
import { fetchSession, openSession, submitMyEvaluation, updateSessionShared } from "@/lib/actions/assessment";
import { getMySelf, saveMySelfAssessmentAction } from "@/lib/actions/assessment-self";

/** The signed-in viewer's own identity — used to auto-fill their Self Assessment. */
export interface Viewer {
  userId: string;
  name: string;
  department: string | null;
  jabatan: string | null;
}
/** Self-assessment promotion identity (kept separate from the evaluator candidate). */
export interface SelfIdentity {
  golongan: string;
  golonganTujuan: string;
  batch: string;
  nik: string;
}
const EMPTY_SELF_ID: SelfIdentity = { golongan: "", golonganTujuan: "", batch: "", nik: "" };

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
  /** The signed-in user's PRIMARY evaluator identity, or null if not an evaluator. */
  evaluator: EvaluatorIdentity | null;
  /** Every evaluator hat this account wears (HC who also heads a division → 2). */
  evaluators: EvaluatorIdentity[];
  /** The column this account is currently filling (dual-role accounts switch). */
  myKey: EvaluatorKey | null;
  setMyKey: (k: EvaluatorKey) => void;
  /** My hats that actually apply to the selected candidate. */
  myKeysForCandidate: EvaluatorKey[];
  /** How many participants this account reviews as a Rekan Sejawat. */
  peerCount: number;
  /** Live server-backed session for the selected candidate (evaluator flow). */
  session: SessionState | null;
  sessionBusy: boolean;
  /** Submit/save the signed-in evaluator's own column — independent of the others. */
  submitMine: (patch: {
    evaluatorKey?: EvaluatorKey;
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
  /** Quick-pick a participant from the evaluator queue (fills who + batch). */
  pickParticipant: (userId: string, department: string, jabatan: string) => void;
  /** Clear the current candidate + scores (return to the queue). */
  resetCandidate: () => void;
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

  /** The signed-in viewer (for auto-identifying their own Self Assessment). */
  viewer: Viewer;
  /** The viewer's own promotion identity (self flow, not the evaluator candidate). */
  selfId: SelfIdentity;
  patchSelfId: (patch: Partial<SelfIdentity>) => void;
  selfIdentityComplete: boolean;
  /** Persist the viewer's Self Assessment to their own session. */
  saveMySelf: () => Promise<{ ok: boolean; error?: string }>;
  selfBusy: boolean;

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
  evaluators,
  peerCount = 0,
  showSample = true,
  viewer = { userId: "", name: "", department: null, jabatan: null },
}: {
  children: React.ReactNode;
  initialRole?: AssessmentRole;
  canSwitchRole?: boolean;
  evaluator?: EvaluatorIdentity | null;
  /** Every hat this account wears; defaults to just the primary identity. */
  evaluators?: EvaluatorIdentity[];
  peerCount?: number;
  showSample?: boolean;
  viewer?: Viewer;
}) {
  const myHats = React.useMemo<EvaluatorIdentity[]>(
    () => (evaluators && evaluators.length ? evaluators : evaluator ? [evaluator] : []),
    [evaluators, evaluator],
  );
  const [role, setRoleState] = React.useState<AssessmentRole>(initialRole);
  const [tab, setTabState] = React.useState<TabKey>("panduan");
  const [visited, setVisited] = React.useState<Set<TabKey>>(new Set<TabKey>(["panduan"]));
  const [entrance, setEntrance] = React.useState(false); // true only for button-driven navigation

  const [candidate, setCandidate] = React.useState<Candidate>({ ...EMPTY_CANDIDATE });
  const [syarat, setSyarat] = React.useState<Record<number, boolean>>({ 1: false, 2: false, 3: false });
  const [self, setSelf] = React.useState<ParamScores>({});
  const [selfId, setSelfId] = React.useState<SelfIdentity>({ ...EMPTY_SELF_ID });
  const patchSelfId = React.useCallback((patch: Partial<SelfIdentity>) => setSelfId((s) => ({ ...s, ...patch })), []);
  const [selfBusy, setSelfBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  // Load the viewer's saved Self Assessment (identity + scores) once, so it
  // survives across devices/sessions — not just localStorage.
  React.useEffect(() => {
    if (!viewer.userId) return;
    let live = true;
    getMySelf().then((r) => {
      if (!live || !r) return;
      if (Object.keys(r.selfScores).length) setSelf(r.selfScores);
      setSelfId((s) => ({
        golongan: r.identity.golongan || s.golongan,
        golonganTujuan: r.identity.golonganTujuan || s.golonganTujuan,
        batch: r.identity.batch || s.batch,
        nik: r.identity.nik || s.nik,
      }));
      if (r.submitted) setSaved(true);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer.userId]);
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
  // The seed for the selected candidate. Sent with a SAVE so the server can open
  // the session at that moment — sessions are never created just by viewing.
  const seedRef = React.useRef<SessionSeed | null>(null);

  // ── draft persistence: survive a refresh (frontend-only, no backend yet) ──
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        // `candidate` is deliberately NOT restored: a remembered pick made the
        // page silently re-create the session on every load, resurrecting an
        // assessment an admin had just deleted. Evaluators start at the queue.
        if (d.syarat) setSyarat(d.syarat);
        if (d.self) setSelf(d.self);
      }
    } catch {}
    setHydrated(true);
  }, []);
  // NOTE: evaluation scores/interview/notes are deliberately NOT persisted here.
  // They belong to ONE candidate and are the server's source of truth; keeping
  // them in a shared draft made a freshly-opened candidate show the PREVIOUS
  // candidate's answers (the "penilaian sudah otomatis terisi" bug).
  React.useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ syarat, self }));
    } catch {}
  }, [hydrated, syarat, self]);

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
  // Guard: only a deliberate pick in THIS visit may create a server session.
  // Without it, any restored/derived candidate silently re-created a session an
  // admin had just deleted.
  const pickedRef = React.useRef(false);
  const setEmployee = React.useCallback((id: string) => {
    pickedRef.current = true;
    setCandidate((c) => ({ ...c, employeeId: id }));
  }, []);
  const patchCandidate = React.useCallback((patch: Partial<Candidate>) => setCandidate((c) => ({ ...c, ...patch })), []);

  // Quick-pick a participant from the evaluator's queue: fill dept/position/name
  // (and a default batch) so the session opens immediately — golongan/tujuan can
  // be completed by HC later. `userId` maps to the mirrored org employee id.
  const pickParticipant = React.useCallback((userId: string, department: string, jabatan: string) => {
    pickedRef.current = true;
    setCandidate((c) => ({
      ...c,
      departmentId: orgDepartmentId(department),
      positionId: orgPositionId(department, jabatan),
      employeeId: `emp_usr_${userId}`,
      batch: c.batch || BATCHES[0],
    }));
  }, []);

  // Clear the current candidate + local scores → back to the queue (reset ke 0).
  const resetCandidate = React.useCallback(() => {
    pickedRef.current = false;
    setCandidate({ ...EMPTY_CANDIDATE });
    setScores(emptyEvaluatorScores());
    setEvaluatorNotes({});
    setSession(null);
  }, []);

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

  // ── Which of MY columns apply to the selected candidate ──
  const myKeysForCandidate = React.useMemo<EvaluatorKey[]>(() => {
    const required = new Set(activeEvaluators.map((e) => e.key));
    return myHats.map((h) => h.evaluatorKey).filter((k) => required.has(k));
  }, [myHats, activeEvaluators]);
  const [myKeyState, setMyKeyState] = React.useState<EvaluatorKey | null>(null);
  const myKey: EvaluatorKey | null =
    myKeyState && myKeysForCandidate.includes(myKeyState) ? myKeyState : myKeysForCandidate[0] ?? null;
  const setMyKey = React.useCallback((k: EvaluatorKey) => setMyKeyState(k), []);

  // ── Switching candidate must NEVER carry the previous person's answers over ──
  const candidateKey = `${candidate.departmentId}|${candidate.positionId}|${candidate.employeeId}`;
  const lastCandidateRef = React.useRef(candidateKey);
  React.useEffect(() => {
    if (lastCandidateRef.current === candidateKey) return;
    lastCandidateRef.current = candidateKey;
    setScores(emptyEvaluatorScores());
    setInterview({});
    setIvVotes({});
    setEvaluatorNotes({});
    setIvNote("");
    setFinancialImpact(false);
  }, [candidateKey]);

  // ── Hydrate from the SERVER: what I already saved for this session, nothing
  //    more. Keyed on the session id so the 5s poll can't clobber live edits. ──
  const hydratedSessionRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!session) {
      hydratedSessionRef.current = null;
      return;
    }
    if (hydratedSessionRef.current === session.id) return;
    hydratedSessionRef.current = session.id;
    const next = emptyEvaluatorScores();
    const notes: Partial<Record<EvaluatorKey, string>> = {};
    const votes: Partial<Record<EvaluatorKey, IvRecValue>> = {};
    let iv: DimensionScores = {};
    for (const row of session.evaluations) {
      // Only MY columns are editable here; the rest is read-only progress.
      if (!myHats.some((h) => h.evaluatorKey === row.evaluatorKey)) continue;
      next[row.evaluatorKey] = { ...row.scores };
      if (row.note) notes[row.evaluatorKey] = row.note;
      if (row.ivVote) votes[row.evaluatorKey] = row.ivVote;
      if (Object.keys(row.interview ?? {}).length) iv = { ...row.interview };
    }
    setScores(next);
    setEvaluatorNotes(notes);
    setIvVotes(votes);
    setInterview(iv);
    setIvNote(session.ivNote ?? "");
    setFinancialImpact(!!session.financialImpact);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, myHats]);
  const penilaianComplete = activeEvaluators.every((e) => evaluatorFilled(scores[e.key]) === PARAMETERS.length);
  // Final interview recommendation = majority vote across the active evaluators.
  const ivRecommendation = React.useMemo(
    () => resolveInterviewRec(activeEvaluators.map((e) => ivVotes[e.key]).filter((v): v is IvRecValue => !!v)),
    [activeEvaluators, ivVotes],
  );
  const continueToInterview = React.useCallback(() => flowTo("interview"), [flowTo]);
  const finishInterview = React.useCallback(() => flowTo("dashboard"), [flowTo]);

  // Enough to open a session and start scoring: who + batch. Golongan/tujuan/NIK
  // are for the decision record and can be completed later (by HC), so they don't
  // block scoring — this makes the queue quick-pick a single click.
  const identityComplete =
    !!candidate.departmentId && !!candidate.positionId && !!candidate.employeeId && !!candidate.batch;

  const syaratPassed = syarat[1] && syarat[2] && syarat[3];
  const selfComplete = PARAMETERS.every((p) => !!self[p.key]);
  const selfIdentityComplete = !!selfId.golongan && !!selfId.golonganTujuan && !!selfId.batch;
  const readyForPenilaian =
    syaratPassed && selfIdentityComplete && selfComplete && visited.has("panduan") && visited.has("referensi");

  // Open (find-or-create) the server session once a logged-in evaluator has a
  // full candidate selected, then poll so other evaluators' progress shows up.
  const isEvaluator = myHats.length > 0;
  const seedKey = isEvaluator
    ? [candidate.departmentId, resolved.nama, candidate.batch].join("|")
    : "";
  React.useEffect(() => {
    if (!isEvaluator || !identityComplete || !resolved.nama || !pickedRef.current) {
      setSession(null);
      return;
    }
    let cancelled = false;
    // Mirrored accounts carry an org-employee id of `emp_usr_<userId>` — extract
    // it so the session links to the participant's account (peers find it by id).
    const participantUserId = candidate.employeeId.startsWith("emp_usr_") ? candidate.employeeId.slice("emp_usr_".length) : undefined;
    const seed: SessionSeed = {
      batch: candidate.batch,
      nik: candidate.nik,
      participantUserId,
      employeeName: resolved.nama,
      jabatan: resolved.jabatan,
      departmentId: candidate.departmentId,
      departmentName: resolved.departemen,
      golongan: formatGolongan(candidate.golongan, candidate.golonganLevel) || candidate.golongan,
      golonganTujuan: formatGolongan(candidate.golonganTujuan, candidate.golonganTujuanLevel) || candidate.golonganTujuan,
      directorOnly: activeEvaluators.length === 1,
    };
    seedRef.current = seed;
    setSessionBusy(true);
    let openedId: string | null = null;
    // CREATE happens exactly once, on this deliberate candidate selection.
    openSession(seed)
      .then((s) => {
        openedId = s?.id ?? null;
        if (!cancelled) setSession(s);
      })
      .finally(() => {
        if (!cancelled) setSessionBusy(false);
      });
    // Poll for cross-device updates every 5s — READ-ONLY. It used to call
    // openSession(), which re-CREATED the session moments after an admin
    // deleted it ("sudah dihapus tapi muncul lagi"). If the row is gone we let
    // the selection go instead of resurrecting it.
    const poll = setInterval(async () => {
      if (!openedId) return;
      const cur = await fetchSession(openedId).catch(() => null);
      if (cancelled) return;
      if (cur) setSession(cur);
      else {
        openedId = null;
        setSession(null);
        setCandidate({ ...EMPTY_CANDIDATE });
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey, identityComplete]);

  const submitMine = React.useCallback(
    async (patch: {
      evaluatorKey?: EvaluatorKey;
      scores?: ParamScores;
      note?: string;
      interview?: DimensionScores;
      ivVote?: IvRecValue | null;
      submitted?: boolean;
    }): Promise<{ ok: boolean; error?: string }> => {
      if (myHats.length === 0) return { ok: false, error: "Akun ini bukan penilai resmi." };
      if (!session && !seedRef.current) return { ok: false, error: "Sesi assessment belum siap. Lengkapi identitas karyawan dulu." };
      setSessionBusy(true);
      try {
        const res = await submitMyEvaluation({
          sessionId: session?.id ?? "",
          seed: seedRef.current ?? undefined,
          evaluatorKey: patch.evaluatorKey ?? myKey ?? undefined,
          ...patch,
        });
        if (res.ok) {
          // Also persist the shared session fields (self-assessment, interview
          // note, fast-track) so the dashboard reflects the full picture.
          const shared = await updateSessionShared(res.session.id, {
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
    [myHats, myKey, session, self, ivNote, financialImpact],
  );

  const saveMySelf = React.useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    setSelfBusy(true);
    try {
      const res = await saveMySelfAssessmentAction({ selfScores: self, ...selfId });
      if (res.ok) setSaved(true);
      return res;
    } catch {
      return { ok: false, error: "Gagal menyimpan Self Assessment." };
    } finally {
      setSelfBusy(false);
    }
  }, [self, selfId]);

  const saveAndContinue = React.useCallback(() => {
    // Persist the viewer's own Self Assessment, then (evaluators) go to Penilaian.
    void saveMySelf().then(() => {
      if (canSeeTab(role, "penilaian")) flowTo("penilaian");
    });
  }, [role, flowTo, saveMySelf]);

  const value: AssessmentState = {
    role,
    setRole,
    canSwitchRole,
    showSample,
    evaluator,
    evaluators: myHats,
    myKey,
    setMyKey,
    myKeysForCandidate,
    peerCount,
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
    pickParticipant,
    resetCandidate,
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
    viewer,
    selfId,
    patchSelfId,
    selfIdentityComplete,
    saveMySelf,
    selfBusy,
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
