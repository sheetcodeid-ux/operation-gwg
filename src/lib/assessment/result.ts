/**
 * Unified result computation for the Dashboard. Both the live in-progress
 * assessment and any historical record are reduced to a single `ResultBundle`
 * so every number on the dashboard is calculated the same, measured way.
 */
import {
  DIMENSIONS,
  EVALUATORS,
  emptyEvaluatorScores,
  evaluatorScore,
  evaluatorsFor,
  filledForEvaluator,
  finalScore,
  gradeTier,
  interviewScore,
  IV_RECOMMENDATIONS,
  PARAMETERS,
  paramsForEvaluator,
  resolveInterviewRec,
  scoreForEvaluator,
  type DimensionKey,
  type DimensionScores,
  type Evaluator,
  type EvaluatorKey,
  type EvaluatorScores,
  type GradeTier,
  type IvRecommendation,
  type IvRecValue,
  type ParamKey,
  type ParamScores,
} from "./config";
import { MOCK_ASSESSMENTS, type AssessmentRecord, type HasilStatus } from "./records";
import type { SessionState } from "./session";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export interface EvalScoreRow {
  key: EvaluatorKey;
  name: string;
  weight: number;
  score: number;
  filled: number;
  done: boolean;
  contribution: number;
}

export interface ParamRow {
  key: ParamKey;
  title: string;
  scale: number;
  weight: number;
  perEvalPct: Partial<Record<EvaluatorKey, number>>;
  perEvalRaw: Partial<Record<EvaluatorKey, number>>;
  selfPct: number | null;
  avgPct: number;
  gapFlag: boolean;
}

export interface ResultBundle {
  evaluators: Evaluator[];
  single: boolean;
  evalScores: EvalScoreRow[];
  final: number;
  tier: GradeTier;
  decisionLabel: string;
  decisionTone: string;
  overridden: boolean;
  ivScore: number;
  ivRek: IvRecommendation | null;
  selfScore: number | null;
  gap: number;
  gapWajib: boolean;
  gapDetail: string | null;
  params: ParamRow[];
  weakParamTitle: string | null;
  totalEvaluators: number;
  filledEvaluators: number;
  allFilled: boolean;
  anyFilled: boolean;
  completionPct: number;
  recommendations: Reco[];
}

/** Follow-up recommendation with a semantic kind (mapped to a lucide icon in UI). */
export type RecoKind = "success" | "info" | "action" | "warning" | "danger" | "fast" | "schedule";
export interface Reco {
  kind: RecoKind;
  text: string;
}

export interface ResultInput {
  scores: EvaluatorScores;
  self: ParamScores;
  interview: DimensionScores;
  ivRecValue: IvRecommendation["value"] | null;
  evaluators: Evaluator[];
  financialImpact: boolean;
}

const EV_LABEL: Record<EvaluatorKey, string> = { al: "Atasan Langsung", hc: "HC / Human Capital", peer: "Rekan Sejawat", dir: "Director" };

/** Reduce raw assessment state into every derived dashboard figure. */
export function computeResult(input: ResultInput): ResultBundle {
  const { scores, self, interview, ivRecValue, evaluators, financialImpact } = input;
  const single = evaluators.length === 1;

  const evalScores: EvalScoreRow[] = evaluators.map((e) => {
    const score = scoreForEvaluator(e.key, scores[e.key]);
    const filled = filledForEvaluator(e.key, scores[e.key]);
    return { key: e.key, name: e.name, weight: e.weight, score, filled, done: filled === paramsForEvaluator(e.key).length, contribution: Math.round(score * (e.weight / 100) * 10) / 10 };
  });
  const done = evalScores.filter((e) => e.done);

  const final = finalScore(scores, evaluators);
  const tier = gradeTier(final);
  const ivScore = interviewScore(interview);
  const ivRek = IV_RECOMMENDATIONS.find((r) => r.value === ivRecValue) ?? null;

  const overridden = ivRecValue === "tidak_layak" && final >= 85;
  const decisionLabel = overridden ? "Tidak Direkomendasikan (Override Interview)" : tier.label;
  const decisionTone = overridden ? "no" : tier.tone;

  // Gap across completed evaluators (spec HTML: ≥20 warn, >35 mandatory calibration).
  let gap = 0;
  let gapWajib = false;
  let gapDetail: string | null = null;
  if (done.length >= 2) {
    const vals = done.map((e) => e.score);
    gap = Math.round((Math.max(...vals) - Math.min(...vals)) * 10) / 10;
    const lo = done.reduce((a, b) => (a.score <= b.score ? a : b));
    const hi = done.reduce((a, b) => (a.score >= b.score ? a : b));
    gapWajib = gap > 35;
    if (gap >= 20) {
      gapDetail = `Gap antar penilai ${gap.toFixed(1)} poin (${EV_LABEL[lo.key]}: ${lo.score.toFixed(1)} vs ${EV_LABEL[hi.key]}: ${hi.score.toFixed(1)}). ${gapWajib ? "Gap > 35 poin — sesi kalibrasi WAJIB sebelum keputusan final." : "Disarankan diskusi kalibrasi antar penilai."}`;
    }
  }

  const selfComplete = PARAMETERS.every((p) => !!self[p.key]);
  const selfScore = selfComplete ? evaluatorScore(self) : null;

  const params: ParamRow[] = PARAMETERS.map((p) => {
    const perEvalPct: Partial<Record<EvaluatorKey, number>> = {};
    const perEvalRaw: Partial<Record<EvaluatorKey, number>> = {};
    const pcts: number[] = [];
    for (const e of done) {
      const raw = scores[e.key][p.key];
      if (raw) {
        const pct = Math.round((raw / p.scale) * 100);
        perEvalPct[e.key] = pct;
        perEvalRaw[e.key] = raw;
        pcts.push(pct);
      }
    }
    const avgPct = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
    const gapFlag = pcts.length >= 2 && Math.max(...pcts) - Math.min(...pcts) >= 20;
    const selfPct = self[p.key] ? Math.round((self[p.key]! / p.scale) * 100) : null;
    return { key: p.key, title: p.title, scale: p.scale, weight: p.weight, perEvalPct, perEvalRaw, selfPct, avgPct, gapFlag };
  });

  const withData = params.filter((p) => Object.keys(p.perEvalPct).length > 0);
  const weak = withData.length ? withData.reduce((a, b) => (a.avgPct <= b.avgPct ? a : b)) : null;

  const totalEvaluators = evaluators.length;
  const filledEvaluators = done.length;
  const allFilled = filledEvaluators === totalEvaluators;
  const filledCells = evaluators.reduce((sum, e) => sum + filledForEvaluator(e.key, scores[e.key]), 0);
  const completionPct = Math.round((filledCells / (totalEvaluators * PARAMETERS.length)) * 100);

  return {
    evaluators,
    single,
    evalScores,
    final,
    tier,
    decisionLabel,
    decisionTone,
    overridden,
    ivScore,
    ivRek,
    selfScore,
    gap,
    gapWajib,
    gapDetail,
    params,
    weakParamTitle: weak?.title ?? null,
    totalEvaluators,
    filledEvaluators,
    allFilled,
    anyFilled: filledEvaluators > 0,
    completionPct,
    recommendations: buildRecommendations(final, ivRecValue, weak?.title ?? null, financialImpact),
  };
}

/** Tiered follow-up recommendations (ported from the HTML dashboard logic). */
function buildRecommendations(
  final: number,
  ivRec: IvRecommendation["value"] | null,
  weakTitle: string | null,
  financial: boolean,
): Reco[] {
  if (ivRec === "tidak_layak") {
    return [
      { kind: "danger", text: "Interview akhir memberikan rekomendasi Tidak Layak. Diskusikan hasil interview secara mendalam sebelum keputusan final." },
      { kind: "info", text: "Lakukan sesi feedback dengan karyawan — komunikasikan concern secara konstruktif." },
      { kind: "schedule", text: "Jadwalkan review ulang dalam 6 bulan dengan fokus pada area concern interviewer." },
    ];
  }
  if (final > 95) {
    return [
      { kind: "fast", text: `Skor melebihi 95${ivRec === "sangat_layak" ? " dan interview sangat positif" : ""} — ajukan ke manajemen senior untuk pertimbangan fast track promotion.` },
      { kind: "info", text: `Verifikasi syarat fast track${financial ? " (dampak finansial sudah dicentang)" : ""} sebelum pengajuan resmi.` },
      { kind: "action", text: "Dokumentasikan seluruh pencapaian luar biasa sebagai bukti pengajuan." },
    ];
  }
  if (final >= 85) {
    const base: Reco[] = [
      { kind: "success", text: "Ajukan dokumen penilaian ini ke HC untuk diproses kenaikan golongan." },
      { kind: "action", text: "Atasan menyiapkan surat rekomendasi → HC memproses administrasi → Director/GM tanda tangan." },
      { kind: "info", text: "Informasikan karyawan bahwa proses kenaikan golongan sedang berjalan." },
    ];
    if (ivRec === "tunda") base.push({ kind: "warning", text: "Hasil interview menimbulkan kekhawatiran. Lakukan diskusi kalibrasi HC + Director sebelum keputusan final." });
    return base;
  }
  if (final >= 70) {
    return [
      { kind: "warning", text: `Ditunda. Fokus perbaikan pada: ${weakTitle ?? "parameter terlemah"} (nilai rata-rata terendah).` },
      { kind: "action", text: "Buat rencana perbaikan tertulis (IDP) yang SMART bersama karyawan." },
      { kind: "schedule", text: "Jadwalkan review ulang dengan penilai yang sama dalam 6 bulan." },
    ];
  }
  return [
    { kind: "danger", text: "Tidak layak. Lakukan evaluasi menyeluruh + program pengembangan intensif minimum 6 bulan." },
    { kind: "action", text: `HC wajib menyusun IDP dengan prioritas pada: ${weakTitle ?? "parameter terlemah"}.` },
    { kind: "schedule", text: "Review ulang setelah ada perbaikan signifikan yang terukur." },
  ];
}

// ── synthetic detail for historical records (so any employee has a full view) ──

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0);
  return h || 1;
}
function rng(seed: number): () => number {
  let s = seed;
  return () => ((s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff);
}

const HASIL_TO_IVREC: Record<HasilStatus, IvRecommendation["value"]> = {
  fast_track: "sangat_layak",
  layak: "layak",
  ditunda: "tunda",
  tidak_layak: "tidak_layak",
};

const TONE_TO_HASIL: Record<string, HasilStatus> = { no: "tidak_layak", wait: "ditunda", ok: "layak", fast: "fast_track" };

/** Stochastic rounding: expected value equals `target`, so quantized picks
 *  average back to the intended score instead of always rounding up to max. */
function pickValue(target: number, scale: number, rand: () => number): number {
  const exact = clamp((target / 100) * scale, 1, scale);
  const lo = Math.floor(exact);
  const hi = Math.ceil(exact);
  if (lo === hi) return clamp(lo, 1, scale);
  return clamp(rand() < exact - lo ? hi : lo, 1, scale);
}

/**
 * Build a deterministic, plausible full detail for a historical record whose
 * evaluator scores average close to its stored finalScore. Enables the
 * per-employee dashboard view with identical calculations.
 */
export function syntheticDetail(record: AssessmentRecord): ResultInput {
  const evaluators = evaluatorsFor({ isHead: /^head/i.test(record.jabatan), title: record.jabatan });
  const r = rng(hash(record.id));
  const scores = emptyEvaluatorScores();
  for (const e of evaluators) {
    // Each evaluator has a slightly different target → realistic per-evaluator spread.
    const evTarget = clamp(record.finalScore + (r() * 10 - 5), 30, 99);
    for (const p of paramsForEvaluator(e.key)) scores[e.key][p.key] = pickValue(evTarget, p.scale, r);
  }
  const self: ParamScores = {};
  for (const p of PARAMETERS) self[p.key] = pickValue(clamp(record.finalScore + (r() * 12 - 6), 30, 99), p.scale, r);
  const interview: DimensionScores = {};
  for (const d of DIMENSIONS as { key: DimensionKey }[]) interview[d.key] = pickValue(record.finalScore, 4, r);

  return {
    scores,
    self,
    interview,
    ivRecValue: HASIL_TO_IVREC[record.hasil],
    evaluators,
    financialImpact: record.hasil === "fast_track",
  };
}

export interface EnrichedRecord extends AssessmentRecord {
  detail: ResultInput;
  bundle: ResultBundle;
}

/**
 * The canonical assessment list: each seed record enriched with a computed
 * detail + bundle, and its headline finalScore/hasil/evaluators overwritten by
 * the computed values so the table, report and per-employee view all agree.
 */
export function enrichRecord(record: AssessmentRecord): EnrichedRecord {
  const detail = syntheticDetail(record);
  const bundle = computeResult(detail);
  return {
    ...record,
    finalScore: bundle.final,
    hasil: TONE_TO_HASIL[bundle.decisionTone],
    interviewResult: bundle.ivRek?.label ?? record.interviewResult,
    decision: bundle.decisionLabel,
    evaluators: bundle.evalScores.map((e) => ({ name: e.name, weight: e.weight, score: e.score })),
    detail,
    bundle,
  };
}

/** Convenience: evaluator set inferred from a plain jabatan title. */
export function evaluatorsForTitle(jabatan: string): Evaluator[] {
  return evaluatorsFor(jabatan ? { isHead: /^head/i.test(jabatan), title: jabatan } : null) ?? EVALUATORS;
}

/** Canonical, computed assessment list (full history) — table + report + timeline. */
export const ASSESSMENTS: EnrichedRecord[] = MOCK_ASSESSMENTS.map(enrichRecord);

/** Every assessment for one employee, newest first (the history timeline). */
export function historyFor(name: string): EnrichedRecord[] {
  return ASSESSMENTS.filter((r) => r.name === name).sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
}

/** Map a live server-backed session into the same enriched record the
 *  dashboard renders — evaluator columns, self, interview and votes reduced
 *  through the one computeResult path. */
export function sessionToEnriched(s: SessionState): EnrichedRecord {
  const evaluators = evaluatorsForTitle(s.jabatan);
  const scores = emptyEvaluatorScores();
  for (const ev of s.evaluations) scores[ev.evaluatorKey] = ev.scores ?? {};
  const withIv = s.evaluations.find((e) => Object.keys(e.interview ?? {}).length > 0);
  const votes = s.evaluations.map((e) => e.ivVote).filter((v): v is IvRecValue => !!v);
  const detail: ResultInput = {
    scores,
    self: s.selfScores ?? {},
    interview: withIv?.interview ?? {},
    ivRecValue: resolveInterviewRec(votes),
    evaluators,
    financialImpact: s.financialImpact,
  };
  const bundle = computeResult(detail);
  const anySubmitted = s.evaluations.some((e) => e.submitted);
  const status = bundle.allFilled ? "Menunggu Interview" : anySubmitted ? "Proses Penilaian" : "Draft";
  const base: AssessmentRecord = {
    id: s.id,
    tanggal: (s.updatedAt || new Date().toISOString()).slice(0, 10),
    batch: s.batch || "—",
    nik: s.nik || "—",
    name: s.employeeName,
    departmentId: s.departmentId,
    departmentName: s.departmentName,
    jabatan: s.jabatan,
    golongan: s.golongan || "—",
    golonganTujuan: s.golonganTujuan || "—",
    penilai: evaluators.map((e) => e.name).join(", "),
    status,
    hasil: TONE_TO_HASIL[bundle.decisionTone],
    finalScore: bundle.final,
    interviewResult: bundle.ivRek?.label ?? "—",
    decision: bundle.decisionLabel,
    evaluators: bundle.evalScores.map((e) => ({ name: e.name, weight: e.weight, score: e.score })),
  };
  return { ...base, detail, bundle };
}

/** The current standing per employee — one latest record each (batch tracking). */
export const LATEST_ASSESSMENTS: EnrichedRecord[] = (() => {
  const byName = new Map<string, EnrichedRecord>();
  for (const r of [...ASSESSMENTS].sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1))) byName.set(r.name, r);
  return [...byName.values()];
})();

/** Decided assessments (latest per employee) whose outcome needs follow-up. */
export const FOLLOW_UP_RECORDS: EnrichedRecord[] = LATEST_ASSESSMENTS.filter(
  (r) => r.status !== "Proses Penilaian" && r.status !== "Draft" && (r.hasil === "ditunda" || r.hasil === "tidak_layak"),
);
