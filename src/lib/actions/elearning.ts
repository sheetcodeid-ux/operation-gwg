"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { canManageElearning, type LessonFileKind } from "@/lib/elearning-shared";
import { presignPut, r2Enabled, R2_PREFIX } from "@/lib/storage/r2";
import {
  addLessonFile,
  createCourse,
  createDay,
  createLesson,
  deleteCourse,
  deleteDay,
  deleteLesson,
  deleteLessonFile,
  getLessonDetail,
  reorderDays,
  reorderLessons,
  updateCourse,
  updateDay,
  updateLesson,
  upsertProgress,
} from "@/lib/data/elearning";
import type { ELearningLesson } from "@/lib/elearning-shared";
import type { UserProfile } from "@/lib/types";

const manage = (u: UserProfile | null) => canManageElearning(u);
const learn = (u: UserProfile | null) => !!u && canReachMenu(u, "elearning");

function revalidate() {
  revalidatePath("/elearning");
  revalidatePath("/elearning/kelola");
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
  revalidatePath("/elearning");
  return { ok: true };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n || 0)));
}
