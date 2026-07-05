"use client";

import * as React from "react";
import {
  emptyEvaluatorScores,
  MOCK_CANDIDATE,
  type DimensionKey,
  type DimensionScores,
  type EvaluatorKey,
  type EvaluatorScores,
  type IvRecommendation,
  type ParamKey,
  type ParamScores,
} from "@/lib/assessment/config";

export interface Candidate {
  nama: string;
  nik: string;
  jabatan: string;
  golongan: string;
  golonganTujuan: string;
  departemen: string;
  masaKerja: number;
}

interface AssessmentState {
  candidate: Candidate;
  setCandidate: (patch: Partial<Candidate>) => void;

  syarat: Record<number, boolean>;
  toggleSyarat: (id: number, v: boolean) => void;
  syaratPassed: boolean;

  self: ParamScores;
  pickSelf: (key: ParamKey, value: number) => void;

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
  const [candidate, setCandidateState] = React.useState<Candidate>({ ...MOCK_CANDIDATE });
  const [syarat, setSyarat] = React.useState<Record<number, boolean>>({ 1: false, 2: false, 3: false });
  const [self, setSelf] = React.useState<ParamScores>({});
  const [scores, setScores] = React.useState<EvaluatorScores>(emptyEvaluatorScores());
  const [interview, setInterview] = React.useState<DimensionScores>({});
  const [ivNote, setIvNote] = React.useState("");
  const [ivRecommendation, setIvRecommendation] = React.useState<IvRecommendation["value"] | null>(null);
  const [financialImpact, setFinancialImpact] = React.useState(false);

  const setCandidate = React.useCallback((patch: Partial<Candidate>) => setCandidateState((c) => ({ ...c, ...patch })), []);
  const toggleSyarat = React.useCallback((id: number, v: boolean) => setSyarat((s) => ({ ...s, [id]: v })), []);
  const pickSelf = React.useCallback((key: ParamKey, value: number) => setSelf((s) => ({ ...s, [key]: value })), []);
  const pickScore = React.useCallback(
    (evaluator: EvaluatorKey, key: ParamKey, value: number) =>
      setScores((s) => ({ ...s, [evaluator]: { ...s[evaluator], [key]: value } })),
    [],
  );
  const pickDimension = React.useCallback((key: DimensionKey, value: number) => setInterview((s) => ({ ...s, [key]: value })), []);

  const syaratPassed = syarat[1] && syarat[2] && syarat[3];

  const value: AssessmentState = {
    candidate,
    setCandidate,
    syarat,
    toggleSyarat,
    syaratPassed,
    self,
    pickSelf,
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
