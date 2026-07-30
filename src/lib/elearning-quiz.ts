/**
 * Assessment/Quiz model + pure scoring for the E-Learning module.
 *
 * Safe to import from client and server. Grading is deterministic and lives here
 * (unit-tested) — the SERVER grades using the full question set incl. correct
 * answers; the learner is only ever sent `PublicQuiz` (correct answers stripped).
 */

export type QuestionType = "single" | "truefalse" | "multiple" | "order" | "case" | "essay";

export const QUESTION_TYPES: { value: QuestionType; label: string; hint: string }[] = [
  { value: "single", label: "Pilihan Ganda", hint: "Satu jawaban benar." },
  { value: "truefalse", label: "Benar / Salah", hint: "Pernyataan benar atau salah." },
  { value: "multiple", label: "Multiple Answer", hint: "Beberapa jawaban benar (harus lengkap & tepat)." },
  { value: "order", label: "Urutan Langkah", hint: "Susun langkah sesuai urutan yang benar." },
  { value: "case", label: "Studi Kasus", hint: "Skenario + satu jawaban terbaik." },
  { value: "essay", label: "Essay", hint: "Jawaban uraian — dinilai manual." },
];

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.value, t.label]),
) as Record<QuestionType, string>;

export interface QuizOption {
  id: string;
  text: string;
}

/** A quiz question WITHOUT the answer key (safe to send to the learner). */
export interface QuizQuestionPublic {
  id: string;
  type: QuestionType;
  prompt: string;
  scenario: string;
  points: number;
  options: QuizOption[];
  sortOrder: number;
}

/** Full question incl. the correct answer (server / admin only). */
export interface QuizQuestion extends QuizQuestionPublic {
  /** single/truefalse/case → option id; multiple/order → option ids; essay → null. */
  correct: string | string[] | null;
}

export interface QuizMeta {
  id: string;
  lessonId: string;
  courseId: string;
  title: string;
  timeLimitSec: number;
  passScore: number;
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
}

export interface AdminQuiz extends QuizMeta {
  questions: QuizQuestion[];
}
export interface PublicQuiz extends QuizMeta {
  questions: QuizQuestionPublic[];
}

/** A learner's answer: option id (single/tf/case), option ids (multiple/order), or text (essay). */
export type QuizAnswer = string | string[];
export type QuizAnswers = Record<string, QuizAnswer>;

/** Strip the answer key so a quiz can be sent to the learner. */
export function toPublicQuiz(quiz: AdminQuiz): PublicQuiz {
  return { ...quiz, questions: quiz.questions.map(({ correct: _c, ...rest }) => rest) };
}

function arrayEq(a: string[], b: string[], ordered: boolean): boolean {
  if (a.length !== b.length) return false;
  if (ordered) return a.every((x, i) => x === b[i]);
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((x, i) => x === sb[i]);
}

/** Grade one question. `auto:false` means it needs manual review (essay). */
export function gradeQuestion(q: QuizQuestion, ans: QuizAnswer | undefined): { auto: boolean; correct: boolean } {
  if (q.type === "essay") return { auto: false, correct: false };
  if (q.correct == null) return { auto: true, correct: false };
  switch (q.type) {
    case "single":
    case "truefalse":
    case "case":
      return { auto: true, correct: typeof ans === "string" && ans === q.correct };
    case "multiple":
      return { auto: true, correct: Array.isArray(ans) && Array.isArray(q.correct) && arrayEq(ans, q.correct, false) };
    case "order":
      return { auto: true, correct: Array.isArray(ans) && Array.isArray(q.correct) && arrayEq(ans, q.correct, true) };
    default:
      return { auto: true, correct: false };
  }
}

export interface QuizGrade {
  score: number; // 0..100 over auto-gradable points
  earned: number;
  total: number; // total auto-gradable points
  needsReview: boolean; // has essay awaiting manual grade
  detail: { questionId: string; correct: boolean; auto: boolean }[];
}

/** Auto-grade a whole quiz. Essay questions are excluded from the score and flag review. */
export function gradeQuiz(questions: QuizQuestion[], answers: QuizAnswers): QuizGrade {
  let earned = 0;
  let total = 0;
  let needsReview = false;
  const detail: QuizGrade["detail"] = [];
  for (const q of questions) {
    const g = gradeQuestion(q, answers[q.id]);
    if (!g.auto) {
      needsReview = true;
      detail.push({ questionId: q.id, correct: false, auto: false });
      continue;
    }
    total += q.points;
    if (g.correct) earned += q.points;
    detail.push({ questionId: q.id, correct: g.correct, auto: true });
  }
  const score = total > 0 ? Math.round((earned / total) * 100) : 0;
  return { score, earned, total, needsReview, detail };
}

/** True/false questions use these fixed options. */
export const TRUE_FALSE_OPTIONS: QuizOption[] = [
  { id: "true", text: "Benar" },
  { id: "false", text: "Salah" },
];

/** Fisher–Yates shuffle (returns a new array). */
export function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Whether a learner has fully answered a question (for the "submit" gate). */
export function isAnswered(q: QuizQuestionPublic, ans: QuizAnswer | undefined): boolean {
  if (ans == null) return false;
  if (q.type === "multiple") return Array.isArray(ans) && ans.length > 0;
  if (q.type === "order") return Array.isArray(ans) && ans.length === q.options.length;
  if (q.type === "essay") return typeof ans === "string" && ans.trim().length > 0;
  return typeof ans === "string" && ans.length > 0;
}
