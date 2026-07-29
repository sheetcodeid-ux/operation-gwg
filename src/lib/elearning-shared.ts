import type { Tone } from "@/lib/constants";
import type { Role } from "@/lib/types";

/**
 * Shared E-Learning types + helpers. Lives OUTSIDE the server-only data module so
 * both the server (`data/elearning.ts`, `actions/elearning.ts`) and client
 * components (`components/elearning/*`) can import the shapes and pure helpers.
 *
 * Access model (Fase 1):
 *   - Head Operational (role `head_operation`) + Super Admin  → manage everything
 *     (courses, days, lessons, upload video/PDF/SOP, settings). Only they upload.
 *   - Coordinator Area (role `area_coordinator`)              → learn only
 *     (view materials, watch video, download if allowed, track own progress).
 */

/** Only Head Operational + Super Admin may create/edit/upload/delete. */
export function canManageElearning(user: { role: Role } | null | undefined): boolean {
  return !!user && (user.role === "super_admin" || user.role === "head_operation");
}

/** Roles that are learners (peserta). Coordinator Area only, for now. */
export function isElearningLearner(user: { role: Role } | null | undefined): boolean {
  return user?.role === "area_coordinator";
}

export type LessonFileKind = "pdf" | "sop" | "image" | "doc" | "other";

export const FILE_KIND_META: Record<LessonFileKind, { label: string; icon: string; tone: Tone }> = {
  pdf: { label: "PDF", icon: "FileText", tone: "danger" },
  sop: { label: "SOP", icon: "ClipboardList", tone: "cyan" },
  image: { label: "Gambar", icon: "Image", tone: "success" },
  doc: { label: "Dokumen", icon: "File", tone: "neutral" },
  other: { label: "Lampiran", icon: "Paperclip", tone: "neutral" },
};

/** Infer a file kind from its MIME type + name (for the upload flow). */
export function fileKindOf(type: string, name: string): LessonFileKind {
  const n = name.toLowerCase();
  if (type === "application/pdf" || n.endsWith(".pdf")) return /sop/i.test(name) ? "sop" : "pdf";
  if (type.startsWith("image/")) return "image";
  if (/\.(docx?|xlsx?|pptx?|txt|csv)$/i.test(n)) return "doc";
  return "other";
}

export interface ELearningCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string | null;
  passScore: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ELearningFile {
  id: string;
  lessonId: string;
  kind: LessonFileKind;
  name: string;
  url: string | null;
  size: number;
  downloadable: boolean;
}

export interface ELearningLesson {
  id: string;
  courseId: string;
  dayId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  /** Whether a video is attached (URL only signed in the learner detail view). */
  hasVideo: boolean;
  videoUrl: string | null;
  /** Optional subtitle track (WebVTT), signed only in the detail view. */
  hasSubtitle: boolean;
  subtitleUrl: string | null;
  estimatedMinutes: number;
  required: boolean;
  allowSkip: boolean;
  mustCompleteVideo: boolean;
  tags: string[];
  sortOrder: number;
  fileCount: number;
  files?: ELearningFile[];
}

export interface ELearningDay {
  id: string;
  courseId: string;
  title: string;
  description: string;
  sortOrder: number;
  lessons: ELearningLesson[];
}

/** One learner's progress on a single lesson. */
export interface LessonProgress {
  lessonId: string;
  videoSeconds: number;
  videoCompleted: boolean;
  completed: boolean;
  lastViewedAt: string | null;
}

export type LearnerStatus = "not_started" | "learning" | "done";

export const LEARNER_STATUS_META: Record<LearnerStatus, { label: string; tone: Tone }> = {
  not_started: { label: "Belum Mulai", tone: "neutral" },
  learning: { label: "Sedang Belajar", tone: "cyan" },
  done: { label: "Selesai", tone: "success" },
};

/** Human estimate label, e.g. "1 jam 5 mnt" / "25 mnt". */
export function fmtMinutes(min: number): string {
  if (!min || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} jam` : "", m ? `${m} mnt` : ""].filter(Boolean).join(" ") || "0 mnt";
}

/** Total estimated minutes across a course's lessons. */
export function courseMinutes(days: ELearningDay[]): number {
  return days.reduce((s, d) => s + d.lessons.reduce((a, l) => a + l.estimatedMinutes, 0), 0);
}

/** Flatten a course tree into an ordered lesson list (day order → lesson order). */
export function orderedLessons(days: ELearningDay[]): ELearningLesson[] {
  return [...days]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((d) => [...d.lessons].sort((a, b) => a.sortOrder - b.sortOrder));
}

/** Overall course completion for a learner (0–100) from a progress map. */
export function courseCompletion(days: ELearningDay[], progress: Record<string, LessonProgress>): number {
  const lessons = orderedLessons(days);
  if (lessons.length === 0) return 0;
  const done = lessons.filter((l) => progress[l.id]?.completed).length;
  return Math.round((done / lessons.length) * 100);
}

/** The learner's overall status across the course. */
export function courseStatus(days: ELearningDay[], progress: Record<string, LessonProgress>): LearnerStatus {
  const pct = courseCompletion(days, progress);
  if (pct >= 100) return "done";
  const anyTouched = orderedLessons(days).some((l) => progress[l.id]);
  return anyTouched ? "learning" : "not_started";
}

/** Whether a lesson is unlocked for the learner: the first lesson is always open;
 *  otherwise the previous lesson must be completed — UNLESS it allows skipping. */
export function lessonUnlocked(
  lessons: ELearningLesson[],
  index: number,
  progress: Record<string, LessonProgress>,
): boolean {
  if (index <= 0) return true;
  const prev = lessons[index - 1];
  if (!prev) return true;
  if (prev.allowSkip) return true;
  return !!progress[prev.id]?.completed;
}

/** The lesson the learner should resume at — first not-completed, else the last. */
export function resumeLessonId(days: ELearningDay[], progress: Record<string, LessonProgress>): string | null {
  const lessons = orderedLessons(days);
  const next = lessons.find((l) => !progress[l.id]?.completed);
  return (next ?? lessons[lessons.length - 1])?.id ?? null;
}
