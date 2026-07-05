"use client";

import * as React from "react";
import {
  emptyEvaluatorScores,
  PARAMETERS,
  type DimensionKey,
  type DimensionScores,
  type EvaluatorKey,
  type EvaluatorScores,
  type IvRecommendation,
  type ParamKey,
  type ParamScores,
} from "@/lib/assessment/config";
import { getDepartment, getEmployee, getPosition } from "@/lib/assessment/org";
import type { AssessmentRole, TabKey } from "@/lib/assessment/access";
import { canSeeTab, TAB_ACCESS } from "@/lib/assessment/access";

/** Cascading identity: department → position → employee, plus the manual fields. */
export interface Candidate {
  departmentId: string;
  positionId: string;
  employeeId: string;
  nik: string;
  golongan: string;
  golonganTujuan: string;
  batch: string;
}

const EMPTY_CANDIDATE: Candidate = {
  departmentId: "",
  positionId: "",
  employeeId: "",
  nik: "",
  golongan: "",
  golonganTujuan: "",
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

  tab: TabKey;
  setTab: (t: TabKey) => void;
  visited: Set<TabKey>;

  candidate: Candidate;
  resolved: ResolvedCandidate;
  setDepartment: (id: string) => void;
  setPosition: (id: string) => void;
  setEmployee: (id: string) => void;
  patchCandidate: (patch: Partial<Candidate>) => void;
  identityComplete: boolean;

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
  ivRecommendation: IvRecommendation["value"] | null;
  setIvRecommendation: (v: IvRecommendation["value"]) => void;

  financialImpact: boolean;
  setFinancialImpact: (v: boolean) => void;
}

const Ctx = React.createContext<AssessmentState | null>(null);

export function useAssessment(): AssessmentState {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useAssessment must be used inside <AssessmentProvider>");
  return ctx;
}

export function AssessmentProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = React.useState<AssessmentRole>("director");
  const [tab, setTabState] = React.useState<TabKey>("panduan");
  const [visited, setVisited] = React.useState<Set<TabKey>>(new Set<TabKey>(["panduan"]));

  const [candidate, setCandidate] = React.useState<Candidate>({ ...EMPTY_CANDIDATE });
  const [syarat, setSyarat] = React.useState<Record<number, boolean>>({ 1: false, 2: false, 3: false });
  const [self, setSelf] = React.useState<ParamScores>({});
  const [saved, setSaved] = React.useState(false);
  const [scores, setScores] = React.useState<EvaluatorScores>(emptyEvaluatorScores());
  const [interview, setInterview] = React.useState<DimensionScores>({});
  const [ivNote, setIvNote] = React.useState("");
  const [ivRecommendation, setIvRecommendation] = React.useState<IvRecommendation["value"] | null>(null);
  const [financialImpact, setFinancialImpact] = React.useState(false);

  const setTab = React.useCallback((t: TabKey) => {
    setTabState(t);
    setVisited((v) => (v.has(t) ? v : new Set(v).add(t)));
  }, []);

  const setRole = React.useCallback((r: AssessmentRole) => {
    setRoleState(r);
    // Keep the current tab only if the new role may see it; else jump to its first tab.
    setTabState((cur) => (canSeeTab(r, cur) ? cur : TAB_ACCESS[r][0]));
  }, []);

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

  const saveAndContinue = React.useCallback(() => {
    setSaved(true);
    // Karyawan may not access Penilaian (spec §3) — only advance when allowed.
    if (canSeeTab(role, "penilaian")) setTab("penilaian");
  }, [role, setTab]);

  const value: AssessmentState = {
    role,
    setRole,
    tab,
    setTab,
    visited,
    candidate,
    resolved,
    setDepartment,
    setPosition,
    setEmployee,
    patchCandidate,
    identityComplete,
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
    ivRecommendation,
    setIvRecommendation,
    financialImpact,
    setFinancialImpact,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
