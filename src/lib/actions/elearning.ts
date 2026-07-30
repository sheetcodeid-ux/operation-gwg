"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { saveNotification } from "@/lib/data/persist";
import { learnerIds } from "@/lib/data/elearning-admin";
import { canReachMenu } from "@/lib/nav";
import { canManageElearning, type LessonFileKind } from "@/lib/elearning-shared";
import { presignPut, r2Enabled, R2_PREFIX } from "@/lib/storage/r2";
import {
  addLessonFile,
  addQuestion,
  createCourse,
  createDay,
  createLesson,
  deleteCourse,
  deleteDay,
  deleteLesson,
  deleteLessonFile,
  deleteQuestion,
  deleteQuiz,
  ensureQuiz,
  getCourse,
  getLessonDetail,
  getQuizAdmin,
  maybeIssueCertificate,
  passQuizResult,
  reorderDays,
  reorderLessons,
  reorderQuestions,
  saveQuizResult,
  updateCourse,
  updateDay,
  updateLesson,
  updateQuestion,
  updateQuizSettings,
  upsertProgress,
} from "@/lib/data/elearning";
import { gradeQuiz, type AdminQuiz, type QuizAnswers, type QuizQuestion } from "@/lib/elearning-quiz";
import type { ELearningLesson } from "@/lib/elearning-shared";
import type { UserProfile } from "@/lib/types";

const manage = (u: UserProfile | null) => canManageElearning(u);
const learn = (u: UserProfile | null) => !!u && canReachMenu(u, "elearning");

function revalidate() {
  revalidatePath("/elearning");
  revalidatePath("/elearning/kelola");
}

/** Notify one learner (topbar bell) about an E-Learning event. */
async function notifyUser(userId: string, title: string, message: string, severity: "info" | "warning" = "info") {
  await saveNotification({
    id: `ntf_${randomUUID()}`, kind: "elearning", title, message,
    targetUser: userId, severity, read: false, createdAt: new Date().toISOString(),
  }).catch(() => {});
}

/** Broadcast to every learner (e.g. new material published). */
async function notifyAllLearners(title: string, message: string) {
  const ids = learnerIds();
  await Promise.all(ids.map((id) => notifyUser(id, title, message))).catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Uploads (Head Operational only) — direct browser → R2 presigned PUT */
/* ------------------------------------------------------------------ */

const MAX_VIDEO = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_DOC = 50 * 1024 * 1024; // 50 MB

/** Issue a presigned PUT URL for a lesson asset. `folder` = video|thumbnail|file|subtitle. */
export async function presignElearningUploadAction(input: { name: string; type: string; size: number; folder: "video" | "thumbnail" | "file" | "subtitle" }) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Hanya Head Operational yang dapat mengunggah." } as const;
  if (!r2Enabled()) return { error: "Penyimpanan (R2) belum aktif." } as const;

  const isVideo = input.folder === "video";
  if (isVideo && !input.type.startsWith("video/")) return { error: "File video tidak valid." } as const;
  if (input.folder === "thumbnail" && !input.type.startsWith("image/")) return { error: "Thumbnail harus berupa gambar." } as const;
  if (input.folder === "subtitle" && !/\.vtt$/i.test(input.name)) return { error: "Subtitle harus berformat .vtt (WebVTT)." } as const;
  const limit = isVideo ? MAX_VIDEO : MAX_DOC;
  if (input.size > limit) return { error: `Ukuran melebihi batas (${isVideo ? "2 GB" : "50 MB"}).` } as const;

  const safe = input.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const key = `elearning/${input.folder}/${Date.now()}-${randomUUID().slice(0, 8)}-${safe}`;
  const url = await presignPut(key, input.type || "application/octet-stream", 60 * 30); // 30 min for large video
  return { ok: true, path: `${R2_PREFIX}${key}`, url } as const;
}

/* ------------------------------------------------------------------ */
/* Course                                                              */
/* ------------------------------------------------------------------ */

export async function createCourseAction(input: { title: string; description: string; category: string; passScore: number; thumbnailPath: string | null }) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  if (!input.title.trim()) return { error: "Judul course wajib diisi." };
  const rec = await createCourse({
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category.trim(),
    passScore: clampScore(input.passScore),
    thumbnailPath: input.thumbnailPath,
    createdBy: user!.id,
  });
  if (!rec) return { error: "Gagal membuat course." };
  revalidate();
  return { ok: true, id: rec.id };
}

export async function updateCourseAction(id: string, patch: { title?: string; description?: string; category?: string; passScore?: number; thumbnailPath?: string | null; active?: boolean }) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const res = await updateCourse(id, { ...patch, passScore: patch.passScore !== undefined ? clampScore(patch.passScore) : undefined });
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

export async function deleteCourseAction(id: string) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const res = await deleteCourse(id);
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Days (Hari 1..N — add / edit / delete / reorder, no coding)         */
/* ------------------------------------------------------------------ */

export async function createDayAction(input: { courseId: string; title: string; description: string }) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  if (!input.title.trim()) return { error: "Judul hari wajib diisi." };
  const rec = await createDay({ courseId: input.courseId, title: input.title.trim(), description: input.description.trim() });
  if (!rec) return { error: "Gagal menambah hari." };
  await notifyAllLearners("Materi pembelajaran baru", `Tahap baru dibuka: "${input.title.trim()}". Silakan lanjutkan pembelajaran Anda.`);
  revalidate();
  return { ok: true, id: rec.id };
}

export async function updateDayAction(id: string, patch: { title?: string; description?: string }) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const res = await updateDay(id, patch);
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

export async function deleteDayAction(id: string) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const res = await deleteDay(id);
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

export async function reorderDaysAction(orderedIds: string[]) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const res = await reorderDays(orderedIds);
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Lessons (materi)                                                    */
/* ------------------------------------------------------------------ */

export interface LessonActionInput {
  title: string;
  description: string;
  thumbnailPath: string | null;
  videoPath: string | null;
  subtitlePath: string | null;
  estimatedMinutes: number;
  required: boolean;
  allowSkip: boolean;
  mustCompleteVideo: boolean;
  tags: string[];
}

export async function createLessonAction(input: LessonActionInput & { courseId: string; dayId: string }) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  if (!input.title.trim()) return { error: "Judul materi wajib diisi." };
  const rec = await createLesson({
    courseId: input.courseId,
    dayId: input.dayId,
    title: input.title.trim(),
    description: input.description.trim(),
    thumbnailPath: input.thumbnailPath,
    videoPath: input.videoPath,
    subtitlePath: input.subtitlePath,
    estimatedMinutes: Math.max(0, Math.round(input.estimatedMinutes || 0)),
    required: input.required,
    allowSkip: input.allowSkip,
    mustCompleteVideo: input.mustCompleteVideo,
    tags: input.tags.map((t) => t.trim()).filter(Boolean).slice(0, 12),
    createdBy: user!.id,
  });
  if (!rec) return { error: "Gagal membuat materi." };
  await notifyAllLearners("Materi baru tersedia", `"${input.title.trim()}" telah ditambahkan ke pembelajaran. Yuk pelajari sekarang.`);
  revalidate();
  return { ok: true, id: rec.id };
}

export async function updateLessonAction(id: string, patch: Partial<LessonActionInput>) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const res = await updateLesson(id, {
    ...patch,
    tags: patch.tags ? patch.tags.map((t) => t.trim()).filter(Boolean).slice(0, 12) : undefined,
    estimatedMinutes: patch.estimatedMinutes !== undefined ? Math.max(0, Math.round(patch.estimatedMinutes || 0)) : undefined,
  });
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

export async function deleteLessonAction(id: string) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const res = await deleteLesson(id);
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

export async function reorderLessonsAction(orderedIds: string[]) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const res = await reorderLessons(orderedIds);
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Lesson files (PDF / SOP / gambar / dokumen)                         */
/* ------------------------------------------------------------------ */

export async function addLessonFileAction(input: { courseId: string; dayId: string; lessonId: string; kind: LessonFileKind; name: string; path: string; size: number; downloadable: boolean }) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const rec = await addLessonFile(input);
  if (!rec) return { error: "Gagal menyimpan lampiran." };
  revalidate();
  return { ok: true, id: rec.id };
}

export async function deleteLessonFileAction(id: string) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const res = await deleteLessonFile(id);
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Learner                                                             */
/* ------------------------------------------------------------------ */

/** Fetch a lesson's signed video + files for the learner viewer. */
export async function getLessonDetailAction(lessonId: string): Promise<{ ok: true; lesson: ELearningLesson } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!learn(user) && !manage(user)) return { ok: false, error: "Tidak punya akses." };
  const lesson = await getLessonDetail(lessonId);
  if (!lesson) return { ok: false, error: "Materi tidak ditemukan." };
  return { ok: true, lesson };
}

/** Save the learner's watch position / video-completed flag. */
export async function saveLessonProgressAction(input: { courseId: string; lessonId: string; videoSeconds?: number; videoCompleted?: boolean }) {
  const user = await getSessionUser();
  if (!learn(user) && !manage(user)) return { error: "Tidak punya akses." };
  const res = await upsertProgress({ userId: user!.id, courseId: input.courseId, lessonId: input.lessonId, videoSeconds: input.videoSeconds, videoCompleted: input.videoCompleted });
  if (res.error) return { error: res.error };
  return { ok: true };
}

/** Mark a lesson complete (learner finished the material). */
export async function completeLessonAction(input: { courseId: string; lessonId: string }) {
  const user = await getSessionUser();
  if (!learn(user) && !manage(user)) return { error: "Tidak punya akses." };
  const res = await upsertProgress({ userId: user!.id, courseId: input.courseId, lessonId: input.lessonId, completed: true });
  if (res.error) return { error: res.error };
  const cert = await maybeIssueCertificate(user!.id, input.courseId);
  if (cert.issued) {
    const course = await getCourse(input.courseId);
    await notifyUser(user!.id, "Training selesai 🎉", `Selamat! Anda menyelesaikan "${course?.title ?? "pembelajaran"}". Sertifikat Anda sudah terbit.`);
  }
  revalidatePath("/elearning");
  return { ok: true };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n || 0)));
}

/* ------------------------------------------------------------------ */
/* Assessment / Quiz (Fase 3)                                          */
/* ------------------------------------------------------------------ */

/** Admin: fetch the full quiz (WITH answer key) for the editor. */
export async function getQuizAdminAction(lessonId: string): Promise<{ ok: true; quiz: AdminQuiz | null } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!manage(user)) return { ok: false, error: "Tidak punya akses." };
  return { ok: true, quiz: await getQuizAdmin(lessonId) };
}

export async function saveQuizSettingsAction(input: { courseId: string; lessonId: string; title: string; timeLimitSec: number; passScore: number; shuffleQuestions: boolean; shuffleAnswers: boolean }) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const quizId = await ensureQuiz(input.courseId, input.lessonId);
  if (!quizId) return { error: "Gagal menyiapkan quiz." };
  const res = await updateQuizSettings(quizId, {
    title: input.title.trim() || "Assessment",
    timeLimitSec: Math.max(0, Math.round(input.timeLimitSec || 0)),
    passScore: clampScore(input.passScore),
    shuffleQuestions: input.shuffleQuestions,
    shuffleAnswers: input.shuffleAnswers,
  });
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true, quizId };
}

export async function deleteQuizAction(quizId: string) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const res = await deleteQuiz(quizId);
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

/** Validate a question shape before it's written. */
function validateQuestion(q: Omit<QuizQuestion, "id" | "sortOrder">): string | null {
  if (!q.prompt.trim()) return "Pertanyaan wajib diisi.";
  if (q.type === "essay") return null;
  const optionIds = new Set(q.options.map((o) => o.id));
  if (["single", "multiple", "case", "order"].includes(q.type) && q.options.length < 2) return "Minimal 2 opsi jawaban.";
  if (q.type === "single" || q.type === "case") {
    if (typeof q.correct !== "string" || !optionIds.has(q.correct)) return "Pilih satu jawaban benar.";
  } else if (q.type === "truefalse") {
    if (q.correct !== "true" && q.correct !== "false") return "Pilih Benar atau Salah.";
  } else if (q.type === "multiple") {
    if (!Array.isArray(q.correct) || q.correct.length === 0 || !q.correct.every((c) => optionIds.has(c))) return "Pilih minimal satu jawaban benar.";
  } else if (q.type === "order") {
    if (!Array.isArray(q.correct) || q.correct.length !== q.options.length) return "Tentukan urutan yang benar untuk semua langkah.";
  }
  return null;
}

export async function addQuestionAction(input: { courseId: string; lessonId: string; question: Omit<QuizQuestion, "id" | "sortOrder"> }) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const err = validateQuestion(input.question);
  if (err) return { error: err };
  const quizId = await ensureQuiz(input.courseId, input.lessonId);
  if (!quizId) return { error: "Gagal menyiapkan quiz." };
  const rec = await addQuestion(quizId, input.question);
  if (!rec) return { error: "Gagal menyimpan soal." };
  revalidate();
  return { ok: true, id: rec.id, quizId };
}

export async function updateQuestionAction(id: string, question: Omit<QuizQuestion, "id" | "sortOrder">) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const err = validateQuestion(question);
  if (err) return { error: err };
  const res = await updateQuestion(id, question);
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

export async function deleteQuestionAction(id: string) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const res = await deleteQuestion(id);
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

export async function reorderQuestionsAction(orderedIds: string[]) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const res = await reorderQuestions(orderedIds);
  if (res.error) return { error: res.error };
  revalidate();
  return { ok: true };
}

export interface QuizSubmitResult {
  score: number;
  passScore: number;
  passed: boolean;
  needsReview: boolean;
  detail: { questionId: string; correct: boolean; auto: boolean }[];
}

/**
 * Learner submits quiz answers. Grading happens SERVER-SIDE with the answer key
 * (the client never sees it). On pass, the lesson is marked complete → next
 * lesson unlocks. Failing simply records the attempt so the learner can retry.
 */
export async function submitQuizAction(input: {
  lessonId: string;
  answers: QuizAnswers;
  startedAt: string | null;
}): Promise<{ ok: true; result: QuizSubmitResult } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!learn(user) && !manage(user)) return { ok: false, error: "Tidak punya akses." };

  const quiz = await getQuizAdmin(input.lessonId);
  if (!quiz) return { ok: false, error: "Quiz tidak ditemukan." };
  if (quiz.questions.length === 0) return { ok: false, error: "Quiz belum memiliki soal." };

  const grade = gradeQuiz(quiz.questions, input.answers);
  const passed = grade.total > 0 && grade.score >= quiz.passScore;

  await saveQuizResult({
    quizId: quiz.id,
    lessonId: quiz.lessonId,
    courseId: quiz.courseId,
    userId: user!.id,
    score: grade.score,
    passed,
    needsReview: grade.needsReview,
    answers: input.answers,
    detail: grade.detail,
    startedAt: input.startedAt,
  });

  if (passed) {
    await upsertProgress({ userId: user!.id, courseId: quiz.courseId, lessonId: quiz.lessonId, completed: true });
    await notifyUser(user!.id, "Assessment lulus ✅", `Anda lulus assessment dengan skor ${grade.score}. Materi berikutnya telah terbuka.`);
    const cert = await maybeIssueCertificate(user!.id, quiz.courseId);
    if (cert.issued) {
      const course = await getCourse(quiz.courseId);
      await notifyUser(user!.id, "Training selesai 🎉", `Selamat! Anda menyelesaikan "${course?.title ?? "pembelajaran"}". Sertifikat Anda sudah terbit.`);
    }
  } else {
    await notifyUser(user!.id, "Assessment belum lulus", `Skor Anda ${grade.score} (minimal ${quiz.passScore}). Silakan pelajari ulang dan coba lagi.`, "warning");
  }

  revalidatePath("/elearning");
  return { ok: true, result: { score: grade.score, passScore: quiz.passScore, passed, needsReview: grade.needsReview, detail: grade.detail } };
}

/** Admin: fetch dashboard data — proxied so the client component can poll. */
export async function markEssayPassedAction(resultId: string) {
  const user = await getSessionUser();
  if (!manage(user)) return { error: "Tidak punya akses." };
  const res = await passQuizResult(resultId);
  if (!res) return { error: "Hasil tidak ditemukan." };
  await notifyUser(res.userId, "Assessment dinilai lulus ✅", "Head Operational telah menilai jawaban essay Anda. Materi berikutnya terbuka.");
  const cert = await maybeIssueCertificate(res.userId, res.courseId);
  if (cert.issued) {
    const course = await getCourse(res.courseId);
    await notifyUser(res.userId, "Training selesai 🎉", `Selamat! Anda menyelesaikan "${course?.title ?? "pembelajaran"}". Sertifikat Anda sudah terbit.`);
  }
  revalidate();
  return { ok: true };
}
