import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { markLocalWrite } from "./hydrate";
import { isR2Key, presignGet, r2Delete, r2KeyOf } from "@/lib/storage/r2";
import type {
  ELearningCourse,
  ELearningDay,
  ELearningFile,
  ELearningLesson,
  LessonFileKind,
  LessonProgress,
  QuizResultSummary,
} from "@/lib/elearning-shared";
import { toPublicQuiz, type AdminQuiz, type QuestionType, type QuizAnswers, type QuizQuestion } from "@/lib/elearning-quiz";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Server-only data access for the Enterprise E-Learning module (Fase 1).
 *
 * DB-direct via the service-role client (RLS is locked; the browser never
 * touches these tables). Videos, thumbnails, and lesson files live in Cloudflare
 * R2 and are only ever exposed as short-lived presigned URLs (login-gated,
 * non-shareable), so a leaked link expires quickly.
 */

const SIGN_TTL = 60 * 60; // 1 hour

/** Sign a set of stored R2 keys → path→URL map (cheap local HMAC). */
async function signBatch(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  for (const p of unique) {
    if (isR2Key(p)) {
      const url = await presignGet(r2KeyOf(p), SIGN_TTL);
      if (url) map.set(p, url);
    } else {
      map.set(p, p); // already a usable URL (external / legacy)
    }
  }
  return map;
}

const sign1 = async (path: string | null | undefined): Promise<string | null> => {
  if (!path) return null;
  if (isR2Key(path)) return (await presignGet(r2KeyOf(path), SIGN_TTL)) ?? null;
  return path;
};

/* ---------------- row mappers ---------------- */

const courseFromRow = (r: any, thumbUrl: string | null): ELearningCourse => ({
  id: r.id,
  title: r.title ?? "",
  description: r.description ?? "",
  category: r.category ?? "",
  thumbnailUrl: thumbUrl,
  passScore: r.pass_score ?? 70,
  active: r.active !== false,
  createdAt: r.created_at,
  updatedAt: r.updated_at ?? r.created_at,
});

const lessonFromRow = (r: any, thumbUrl: string | null, fileCount: number, hasQuiz = false): ELearningLesson => ({
  id: r.id,
  courseId: r.course_id,
  dayId: r.day_id,
  title: r.title ?? "",
  description: r.description ?? "",
  thumbnailUrl: thumbUrl,
  hasVideo: !!r.video_path,
  videoUrl: null,
  hasSubtitle: !!r.subtitle_path,
  subtitleUrl: null,
  estimatedMinutes: r.estimated_minutes ?? 0,
  required: r.required !== false,
  allowSkip: !!r.allow_skip,
  mustCompleteVideo: !!r.must_complete_video,
  tags: Array.isArray(r.tags) ? r.tags : [],
  sortOrder: r.sort_order ?? 0,
  fileCount,
  hasQuiz,
});

const questionFromRow = (r: any): QuizQuestion => ({
  id: r.id,
  type: (r.type ?? "single") as QuestionType,
  prompt: r.prompt ?? "",
  scenario: r.scenario ?? "",
  points: r.points ?? 1,
  options: Array.isArray(r.options) ? r.options : [],
  correct: r.correct ?? null,
  sortOrder: r.sort_order ?? 0,
});

const quizFromRows = (r: any, questions: QuizQuestion[]): AdminQuiz => ({
  id: r.id,
  lessonId: r.lesson_id,
  courseId: r.course_id,
  title: r.title ?? "Assessment",
  timeLimitSec: r.time_limit_sec ?? 0,
  passScore: r.pass_score ?? 70,
  shuffleQuestions: r.shuffle_questions !== false,
  shuffleAnswers: r.shuffle_answers !== false,
  questions,
});

const fileFromRow = (r: any, url: string | null): ELearningFile => ({
  id: r.id,
  lessonId: r.lesson_id,
  kind: (r.kind ?? "other") as LessonFileKind,
  name: r.name ?? "",
  url,
  size: Number(r.size ?? 0),
  downloadable: r.downloadable !== false,
});

const progressFromRow = (r: any): LessonProgress => ({
  lessonId: r.lesson_id,
  videoSeconds: r.video_seconds ?? 0,
  videoCompleted: !!r.video_completed,
  completed: !!r.completed,
  lastViewedAt: r.last_viewed_at ?? null,
});

/* ---------------- reads ---------------- */

export async function listCourses(): Promise<ELearningCourse[]> {
  if (!dbEnabled) return [];
  const { data } = await db().from("elearning_courses").select("*").order("created_at", { ascending: true });
  const rows = (data ?? []) as any[];
  const thumbs = await signBatch(rows.map((r) => r.thumbnail_path));
  return rows.map((r) => courseFromRow(r, r.thumbnail_path ? thumbs.get(r.thumbnail_path) ?? null : null));
}

/** The main active course learners see (first active, oldest first). */
export async function getActiveCourse(): Promise<ELearningCourse | null> {
  if (!dbEnabled) return null;
  const { data } = await db()
    .from("elearning_courses")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return courseFromRow(data, await sign1((data as any).thumbnail_path));
}

export async function getCourse(id: string): Promise<ELearningCourse | null> {
  if (!dbEnabled) return null;
  const { data } = await db().from("elearning_courses").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return courseFromRow(data, await sign1((data as any).thumbnail_path));
}

/** Full day → lesson tree for a course (thumbnails signed; video/files lazy). */
export async function getCourseTree(courseId: string): Promise<ELearningDay[]> {
  if (!dbEnabled) return [];
  const [{ data: dayRows }, { data: lessonRows }] = await Promise.all([
    db().from("elearning_days").select("*").eq("course_id", courseId).order("sort_order", { ascending: true }),
    db().from("elearning_lessons").select("*").eq("course_id", courseId).order("sort_order", { ascending: true }),
  ]);
  const days = (dayRows ?? []) as any[];
  const lessons = (lessonRows ?? []) as any[];

  // File counts per lesson (one query).
  const counts = new Map<string, number>();
  if (lessons.length) {
    const { data: fileRows } = await db()
      .from("elearning_files")
      .select("lesson_id")
      .in("lesson_id", lessons.map((l) => l.id));
    for (const f of (fileRows ?? []) as any[]) counts.set(f.lesson_id, (counts.get(f.lesson_id) ?? 0) + 1);
  }

  // Which lessons have a quiz (one query for the course).
  const quizzed = new Set<string>();
  if (lessons.length) {
    const { data: quizRows } = await db().from("elearning_quizzes").select("lesson_id").eq("course_id", courseId);
    for (const qz of (quizRows ?? []) as any[]) quizzed.add(qz.lesson_id);
  }

  const thumbs = await signBatch(lessons.map((l) => l.thumbnail_path));
  const byDay = new Map<string, ELearningLesson[]>();
  for (const l of lessons) {
    const arr = byDay.get(l.day_id) ?? [];
    arr.push(lessonFromRow(l, l.thumbnail_path ? thumbs.get(l.thumbnail_path) ?? null : null, counts.get(l.id) ?? 0, quizzed.has(l.id)));
    byDay.set(l.day_id, arr);
  }
  return days.map((d) => ({
    id: d.id,
    courseId: d.course_id,
    title: d.title ?? "",
    description: d.description ?? "",
    sortOrder: d.sort_order ?? 0,
    lessons: byDay.get(d.id) ?? [],
  }));
}

/** One lesson with its signed video URL + signed files (learner detail view). */
export async function getLessonDetail(lessonId: string): Promise<ELearningLesson | null> {
  if (!dbEnabled) return null;
  const { data } = await db().from("elearning_lessons").select("*").eq("id", lessonId).maybeSingle();
  if (!data) return null;
  const r = data as any;
  const { data: fileRows } = await db()
    .from("elearning_files")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("sort_order", { ascending: true });
  const files = (fileRows ?? []) as any[];
  const fileUrls = await signBatch(files.map((f) => f.path));
  const [videoUrl, thumbUrl, subtitleUrl] = await Promise.all([sign1(r.video_path), sign1(r.thumbnail_path), sign1(r.subtitle_path)]);
  const quiz = await getQuizAdmin(lessonId);
  const lesson = lessonFromRow(r, thumbUrl, files.length, !!quiz);
  lesson.videoUrl = videoUrl;
  lesson.subtitleUrl = subtitleUrl;
  lesson.files = files.map((f) => fileFromRow(f, f.path ? fileUrls.get(f.path) ?? null : null));
  lesson.quiz = quiz ? toPublicQuiz(quiz) : null;
  return lesson;
}

/** A learner's progress across a course as a lessonId → progress map. */
export async function getProgressMap(userId: string, courseId: string): Promise<Record<string, LessonProgress>> {
  if (!dbEnabled || !userId) return {};
  const { data } = await db()
    .from("elearning_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId);
  const out: Record<string, LessonProgress> = {};
  for (const r of (data ?? []) as any[]) out[r.lesson_id] = progressFromRow(r);
  return out;
}

/* ---------------- course writes ---------------- */

export async function createCourse(input: {
  title: string;
  description: string;
  category: string;
  passScore: number;
  thumbnailPath: string | null;
  createdBy: string | null;
}): Promise<{ id: string } | null> {
  if (!dbEnabled) return null;
  markLocalWrite();
  const id = `elc_${randomUUID()}`;
  const { error } = await db().from("elearning_courses").insert({
    id,
    title: input.title,
    description: input.description,
    category: input.category,
    pass_score: input.passScore,
    thumbnail_path: input.thumbnailPath,
    created_by: input.createdBy,
  });
  return error ? null : { id };
}

export async function updateCourse(
  id: string,
  patch: Partial<{ title: string; description: string; category: string; passScore: number; thumbnailPath: string | null; active: boolean }>,
): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const row: any = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.passScore !== undefined) row.pass_score = patch.passScore;
  if (patch.thumbnailPath !== undefined) row.thumbnail_path = patch.thumbnailPath;
  if (patch.active !== undefined) row.active = patch.active;
  const { error } = await db().from("elearning_courses").update(row).eq("id", id);
  return error ? { error: error.message } : {};
}

export async function deleteCourse(id: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  // Best-effort R2 cleanup of all lesson media in the course.
  const { data: lessons } = await db().from("elearning_lessons").select("video_path,thumbnail_path,subtitle_path").eq("course_id", id);
  const { data: files } = await db().from("elearning_files").select("path").eq("course_id", id);
  await cleanupR2([
    ...((lessons ?? []) as any[]).flatMap((l) => [l.video_path, l.thumbnail_path, l.subtitle_path]),
    ...((files ?? []) as any[]).map((f) => f.path),
  ]);
  const { error } = await db().from("elearning_courses").delete().eq("id", id);
  return error ? { error: error.message } : {};
}

/* ---------------- day writes ---------------- */

async function nextSort(table: string, col: string, id: string): Promise<number> {
  const { data } = await db().from(table).select("sort_order").eq(col, id).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  return ((data as any)?.sort_order ?? -1) + 1;
}

export async function createDay(input: { courseId: string; title: string; description: string }): Promise<{ id: string } | null> {
  if (!dbEnabled) return null;
  markLocalWrite();
  const id = `eld_${randomUUID()}`;
  const sort = await nextSort("elearning_days", "course_id", input.courseId);
  const { error } = await db().from("elearning_days").insert({
    id,
    course_id: input.courseId,
    title: input.title,
    description: input.description,
    sort_order: sort,
  });
  return error ? null : { id };
}

export async function updateDay(id: string, patch: Partial<{ title: string; description: string }>): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const row: any = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  const { error } = await db().from("elearning_days").update(row).eq("id", id);
  return error ? { error: error.message } : {};
}

export async function deleteDay(id: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { data: lessons } = await db().from("elearning_lessons").select("video_path,thumbnail_path,subtitle_path").eq("day_id", id);
  const { data: files } = await db().from("elearning_files").select("path").eq("day_id", id);
  await cleanupR2([
    ...((lessons ?? []) as any[]).flatMap((l) => [l.video_path, l.thumbnail_path, l.subtitle_path]),
    ...((files ?? []) as any[]).map((f) => f.path),
  ]);
  const { error } = await db().from("elearning_days").delete().eq("id", id);
  return error ? { error: error.message } : {};
}

/** Persist a new day ordering (array of day ids in the desired order). */
export async function reorderDays(orderedIds: string[]): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  for (let i = 0; i < orderedIds.length; i++) {
    await db().from("elearning_days").update({ sort_order: i, updated_at: new Date().toISOString() }).eq("id", orderedIds[i]);
  }
  return {};
}

/* ---------------- lesson writes ---------------- */

export interface LessonWriteInput {
  title: string;
  description: string;
  thumbnailPath?: string | null;
  videoPath?: string | null;
  subtitlePath?: string | null;
  estimatedMinutes: number;
  required: boolean;
  allowSkip: boolean;
  mustCompleteVideo: boolean;
  tags: string[];
}

export async function createLesson(input: LessonWriteInput & { courseId: string; dayId: string; createdBy: string | null }): Promise<{ id: string } | null> {
  if (!dbEnabled) return null;
  markLocalWrite();
  const id = `ell_${randomUUID()}`;
  const sort = await nextSort("elearning_lessons", "day_id", input.dayId);
  const { error } = await db().from("elearning_lessons").insert({
    id,
    course_id: input.courseId,
    day_id: input.dayId,
    title: input.title,
    description: input.description,
    thumbnail_path: input.thumbnailPath ?? null,
    video_path: input.videoPath ?? null,
    subtitle_path: input.subtitlePath ?? null,
    estimated_minutes: input.estimatedMinutes,
    required: input.required,
    allow_skip: input.allowSkip,
    must_complete_video: input.mustCompleteVideo,
    tags: input.tags,
    sort_order: sort,
    created_by: input.createdBy,
  });
  return error ? null : { id };
}

export async function updateLesson(id: string, patch: Partial<LessonWriteInput>): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const row: any = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.thumbnailPath !== undefined) row.thumbnail_path = patch.thumbnailPath;
  if (patch.videoPath !== undefined) row.video_path = patch.videoPath;
  if (patch.subtitlePath !== undefined) row.subtitle_path = patch.subtitlePath;
  if (patch.estimatedMinutes !== undefined) row.estimated_minutes = patch.estimatedMinutes;
  if (patch.required !== undefined) row.required = patch.required;
  if (patch.allowSkip !== undefined) row.allow_skip = patch.allowSkip;
  if (patch.mustCompleteVideo !== undefined) row.must_complete_video = patch.mustCompleteVideo;
  if (patch.tags !== undefined) row.tags = patch.tags;
  const { error } = await db().from("elearning_lessons").update(row).eq("id", id);
  return error ? { error: error.message } : {};
}

export async function deleteLesson(id: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { data: lesson } = await db().from("elearning_lessons").select("video_path,thumbnail_path,subtitle_path").eq("id", id).maybeSingle();
  const { data: files } = await db().from("elearning_files").select("path").eq("lesson_id", id);
  await cleanupR2([(lesson as any)?.video_path, (lesson as any)?.thumbnail_path, (lesson as any)?.subtitle_path, ...((files ?? []) as any[]).map((f) => f.path)]);
  const { error } = await db().from("elearning_lessons").delete().eq("id", id);
  return error ? { error: error.message } : {};
}

export async function reorderLessons(orderedIds: string[]): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  for (let i = 0; i < orderedIds.length; i++) {
    await db().from("elearning_lessons").update({ sort_order: i, updated_at: new Date().toISOString() }).eq("id", orderedIds[i]);
  }
  return {};
}

/* ---------------- file writes ---------------- */

export async function addLessonFile(input: {
  courseId: string;
  dayId: string;
  lessonId: string;
  kind: LessonFileKind;
  name: string;
  path: string;
  size: number;
  downloadable: boolean;
}): Promise<{ id: string } | null> {
  if (!dbEnabled) return null;
  markLocalWrite();
  const id = `elf_${randomUUID()}`;
  const sort = await nextSort("elearning_files", "lesson_id", input.lessonId);
  const { error } = await db().from("elearning_files").insert({
    id,
    course_id: input.courseId,
    day_id: input.dayId,
    lesson_id: input.lessonId,
    kind: input.kind,
    name: input.name,
    path: input.path,
    size: input.size,
    downloadable: input.downloadable,
    sort_order: sort,
  });
  return error ? null : { id };
}

export async function deleteLessonFile(id: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { data } = await db().from("elearning_files").select("path").eq("id", id).maybeSingle();
  await cleanupR2([(data as any)?.path]);
  const { error } = await db().from("elearning_files").delete().eq("id", id);
  return error ? { error: error.message } : {};
}

/* ---------------- progress writes ---------------- */

export async function upsertProgress(input: {
  userId: string;
  courseId: string;
  lessonId: string;
  videoSeconds?: number;
  videoCompleted?: boolean;
  completed?: boolean;
}): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const now = new Date().toISOString();
  // Read existing to merge (keep max watched position, sticky completion).
  const { data: prev } = await db()
    .from("elearning_progress")
    .select("*")
    .eq("user_id", input.userId)
    .eq("lesson_id", input.lessonId)
    .maybeSingle();
  const p = prev as any;
  const videoSeconds = input.videoSeconds !== undefined ? Math.max(input.videoSeconds, p?.video_seconds ?? 0) : p?.video_seconds ?? 0;
  const videoCompleted = input.videoCompleted ?? p?.video_completed ?? false;
  const completed = input.completed ?? p?.completed ?? false;
  const row = {
    id: p?.id ?? `elp_${randomUUID()}`,
    user_id: input.userId,
    course_id: input.courseId,
    lesson_id: input.lessonId,
    video_seconds: videoSeconds,
    video_completed: videoCompleted,
    completed,
    last_viewed_at: now,
    completed_at: completed ? p?.completed_at ?? now : null,
  };
  const { error } = await db().from("elearning_progress").upsert(row, { onConflict: "user_id,lesson_id" });
  return error ? { error: error.message } : {};
}

/* ---------------- quiz ---------------- */

/** The full quiz (with answer key) for a lesson, or null. Server/admin only. */
export async function getQuizAdmin(lessonId: string): Promise<AdminQuiz | null> {
  if (!dbEnabled) return null;
  const { data } = await db().from("elearning_quizzes").select("*").eq("lesson_id", lessonId).maybeSingle();
  if (!data) return null;
  const { data: qRows } = await db().from("elearning_questions").select("*").eq("quiz_id", (data as any).id).order("sort_order", { ascending: true });
  return quizFromRows(data, ((qRows ?? []) as any[]).map(questionFromRow));
}

export async function getQuizById(quizId: string): Promise<AdminQuiz | null> {
  if (!dbEnabled) return null;
  const { data } = await db().from("elearning_quizzes").select("*").eq("id", quizId).maybeSingle();
  if (!data) return null;
  const { data: qRows } = await db().from("elearning_questions").select("*").eq("quiz_id", quizId).order("sort_order", { ascending: true });
  return quizFromRows(data, ((qRows ?? []) as any[]).map(questionFromRow));
}

/** Find-or-create the quiz for a lesson; returns its id. */
export async function ensureQuiz(courseId: string, lessonId: string): Promise<string | null> {
  if (!dbEnabled) return null;
  markLocalWrite();
  const existing = await db().from("elearning_quizzes").select("id").eq("lesson_id", lessonId).maybeSingle();
  if (existing.data) return (existing.data as any).id;
  const id = `elq_${randomUUID()}`;
  const { error } = await db().from("elearning_quizzes").insert({ id, course_id: courseId, lesson_id: lessonId });
  return error ? null : id;
}

export async function updateQuizSettings(
  quizId: string,
  patch: Partial<{ title: string; timeLimitSec: number; passScore: number; shuffleQuestions: boolean; shuffleAnswers: boolean }>,
): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const row: any = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.timeLimitSec !== undefined) row.time_limit_sec = patch.timeLimitSec;
  if (patch.passScore !== undefined) row.pass_score = patch.passScore;
  if (patch.shuffleQuestions !== undefined) row.shuffle_questions = patch.shuffleQuestions;
  if (patch.shuffleAnswers !== undefined) row.shuffle_answers = patch.shuffleAnswers;
  const { error } = await db().from("elearning_quizzes").update(row).eq("id", quizId);
  return error ? { error: error.message } : {};
}

export async function deleteQuiz(quizId: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { error } = await db().from("elearning_quizzes").delete().eq("id", quizId);
  return error ? { error: error.message } : {};
}

export async function addQuestion(quizId: string, q: Omit<QuizQuestion, "id" | "sortOrder">): Promise<{ id: string } | null> {
  if (!dbEnabled) return null;
  markLocalWrite();
  const id = `elqq_${randomUUID()}`;
  const sort = await nextSort("elearning_questions", "quiz_id", quizId);
  const { error } = await db().from("elearning_questions").insert({
    id, quiz_id: quizId, type: q.type, prompt: q.prompt, scenario: q.scenario, points: q.points,
    options: q.options, correct: q.correct, sort_order: sort,
  });
  return error ? null : { id };
}

export async function updateQuestion(id: string, q: Omit<QuizQuestion, "id" | "sortOrder">): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { error } = await db().from("elearning_questions").update({
    type: q.type, prompt: q.prompt, scenario: q.scenario, points: q.points, options: q.options, correct: q.correct,
  }).eq("id", id);
  return error ? { error: error.message } : {};
}

export async function deleteQuestion(id: string): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  const { error } = await db().from("elearning_questions").delete().eq("id", id);
  return error ? { error: error.message } : {};
}

export async function reorderQuestions(orderedIds: string[]): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  for (let i = 0; i < orderedIds.length; i++) {
    await db().from("elearning_questions").update({ sort_order: i }).eq("id", orderedIds[i]);
  }
  return {};
}

export async function saveQuizResult(input: {
  quizId: string;
  lessonId: string;
  courseId: string;
  userId: string;
  score: number;
  passed: boolean;
  needsReview: boolean;
  answers: QuizAnswers;
  detail: { questionId: string; correct: boolean; auto: boolean }[];
  startedAt: string | null;
}): Promise<{ error?: string }> {
  if (!dbEnabled) return { error: "Database belum aktif." };
  markLocalWrite();
  // Next attempt number for this learner + quiz.
  const { count } = await db()
    .from("elearning_quiz_results")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("quiz_id", input.quizId);
  const attempt = (count ?? 0) + 1;
  const { error } = await db().from("elearning_quiz_results").insert({
    id: `elr_${randomUUID()}`,
    quiz_id: input.quizId,
    lesson_id: input.lessonId,
    course_id: input.courseId,
    user_id: input.userId,
    attempt,
    score: input.score,
    passed: input.passed,
    needs_review: input.needsReview,
    answers: input.answers,
    detail: input.detail,
    started_at: input.startedAt,
  });
  return error ? { error: error.message } : {};
}

/** Best quiz outcome per lesson for a learner (highest score wins). */
export async function getQuizResultsMap(userId: string, courseId: string): Promise<Record<string, QuizResultSummary>> {
  if (!dbEnabled || !userId) return {};
  const { data } = await db()
    .from("elearning_quiz_results")
    .select("lesson_id,score,passed,needs_review")
    .eq("user_id", userId)
    .eq("course_id", courseId);
  const out: Record<string, QuizResultSummary> = {};
  for (const r of (data ?? []) as any[]) {
    const cur = out[r.lesson_id];
    if (!cur) out[r.lesson_id] = { lessonId: r.lesson_id, score: r.score, passed: !!r.passed, attempts: 1, needsReview: !!r.needs_review };
    else {
      cur.attempts += 1;
      cur.passed = cur.passed || !!r.passed;
      cur.score = Math.max(cur.score, r.score);
      cur.needsReview = cur.needsReview || !!r.needs_review;
    }
  }
  return out;
}

/* ---------------- helpers ---------------- */

async function cleanupR2(paths: (string | null | undefined)[]) {
  const keys = paths.filter((p): p is string => !!p && isR2Key(p));
  await Promise.all(keys.map((p) => r2Delete(r2KeyOf(p)).catch(() => {})));
}
