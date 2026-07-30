import { describe, expect, it } from "vitest";
import { gradeQuestion, gradeQuiz, isAnswered, toPublicQuiz, type AdminQuiz, type QuizQuestion } from "./elearning-quiz";

const q = (over: Partial<QuizQuestion>): QuizQuestion => ({
  id: "q", type: "single", prompt: "", scenario: "", points: 1, options: [], sortOrder: 0, correct: null, ...over,
});

describe("gradeQuestion", () => {
  it("single/case/truefalse: exact option id", () => {
    expect(gradeQuestion(q({ type: "single", correct: "a" }), "a")).toEqual({ auto: true, correct: true });
    expect(gradeQuestion(q({ type: "single", correct: "a" }), "b")).toEqual({ auto: true, correct: false });
    expect(gradeQuestion(q({ type: "truefalse", correct: "true" }), "true")).toEqual({ auto: true, correct: true });
    expect(gradeQuestion(q({ type: "case", correct: "x" }), undefined)).toEqual({ auto: true, correct: false });
  });

  it("multiple: exact set, order-independent", () => {
    const mq = q({ type: "multiple", correct: ["a", "c"] });
    expect(gradeQuestion(mq, ["c", "a"]).correct).toBe(true);
    expect(gradeQuestion(mq, ["a"]).correct).toBe(false); // incomplete
    expect(gradeQuestion(mq, ["a", "c", "b"]).correct).toBe(false); // extra
  });

  it("order: exact sequence", () => {
    const oq = q({ type: "order", correct: ["s1", "s2", "s3"] });
    expect(gradeQuestion(oq, ["s1", "s2", "s3"]).correct).toBe(true);
    expect(gradeQuestion(oq, ["s2", "s1", "s3"]).correct).toBe(false);
  });

  it("essay: never auto-graded", () => {
    expect(gradeQuestion(q({ type: "essay", correct: null }), "jawaban")).toEqual({ auto: false, correct: false });
  });
});

describe("gradeQuiz", () => {
  it("scores over auto-gradable points and weights by points", () => {
    const questions = [
      q({ id: "1", type: "single", correct: "a", points: 2 }),
      q({ id: "2", type: "multiple", correct: ["x", "y"], points: 3 }),
    ];
    const g = gradeQuiz(questions, { "1": "a", "2": ["y", "x"] });
    expect(g.earned).toBe(5);
    expect(g.total).toBe(5);
    expect(g.score).toBe(100);
    expect(g.needsReview).toBe(false);
  });

  it("partial score and flags essay for manual review, excluding it from the denominator", () => {
    const questions = [
      q({ id: "1", type: "single", correct: "a", points: 1 }),
      q({ id: "2", type: "single", correct: "a", points: 1 }),
      q({ id: "3", type: "essay", correct: null, points: 5 }),
    ];
    const g = gradeQuiz(questions, { "1": "a", "2": "b", "3": "uraian" });
    expect(g.total).toBe(2); // essay excluded
    expect(g.earned).toBe(1);
    expect(g.score).toBe(50);
    expect(g.needsReview).toBe(true);
  });
});

describe("toPublicQuiz", () => {
  it("strips the answer key from every question", () => {
    const quiz: AdminQuiz = {
      id: "z", lessonId: "l", courseId: "c", title: "T", timeLimitSec: 0, passScore: 70,
      shuffleQuestions: true, shuffleAnswers: true,
      questions: [q({ id: "1", type: "single", correct: "a", options: [{ id: "a", text: "A" }] })],
    };
    const pub = toPublicQuiz(quiz);
    expect("correct" in pub.questions[0]).toBe(false);
    expect(pub.questions[0].options).toHaveLength(1);
  });
});

describe("isAnswered", () => {
  const base = { id: "q", scenario: "", points: 1, sortOrder: 0, options: [{ id: "a", text: "A" }, { id: "b", text: "B" }] };
  it("requires full ordering for order questions", () => {
    expect(isAnswered({ ...base, type: "order", prompt: "" }, ["a"])).toBe(false);
    expect(isAnswered({ ...base, type: "order", prompt: "" }, ["a", "b"])).toBe(true);
  });
  it("requires non-empty text for essay", () => {
    expect(isAnswered({ ...base, type: "essay", prompt: "", options: [] }, "  ")).toBe(false);
    expect(isAnswered({ ...base, type: "essay", prompt: "", options: [] }, "ok")).toBe(true);
  });
});
