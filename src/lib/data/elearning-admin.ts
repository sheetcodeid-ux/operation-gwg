import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { markLocalWrite } from "./hydrate";
import { getUser, getUsers } from "./store";
import { getCourseTree } from "./elearning";
import { courseCompletion, orderedLessons, type AuditAction, type AuditEntity, type ElearningAuditRow, type ElearningDashboard, type EssayReviewItem, type LearnerStatus, type LessonStat, type ParticipantRow } from "@/lib/elearning-shared";
import type { UserProfile } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Server-only aggregates for the Head-Operational E-Learning dashboard: learner
 * progress, pass rate, per-lesson stats, an activity time series, and the essay
 * queue awaiting manual review. All reads go through the service-role client.
 */

/** Active learners (Coordinator Area) — the assessment audience. */
export function listLearners(): UserProfile[] {
  return getUsers().filter((u) => u.role === "area_coordinator" && u.active);
}
export function learnerIds(): string[] {
  return listLearners().map((u) => u.id);
}

const dayKey = (iso: string) => iso.slice(0, 10);

export async function getElearningDashboard(courseId: string): Promise<ElearningDashboard> {
  const learners = listLearners();
  const learnerSet = new Set(learners.map((l) => l.id));

  const tree = await getCourseTree(courseId);
  const lessons = orderedLessons(tree);
  const totalLessons = lessons.length;
  const lessonTitle = new Map(lessons.map((l) => [l.id, l.title]));

  const empty: ElearningDashboard = {
    totalLearners: learners.length, started: 0, completed: 0, passRate: 0, avgScore: 0,
    totalLessons, lessonStats: [], activity: [],
  };
  if (!dbEnabled) return empty;

  const [{ data: progRows }, { data: resultRows }] = await Promise.all([
    db().from("elearning_progress").select("user_id,lesson_id,completed,video_seconds,completed_at,last_viewed_at").eq("course_id", courseId),
    db().from("elearning_quiz_results").select("user_id,lesson_id,score,passed,submitted_at").eq("course_id", courseId),
  ]);

  const prog = ((progRows ?? []) as any[]).filter((r) => learnerSet.has(r.user_id));
  const results = ((resultRows ?? []) as any[]).filter((r) => learnerSet.has(r.user_id));

  // Per-learner completed lessons + started flag.
  const completedByUser = new Map<string, Set<string>>();
  const startedUsers = new Set<string>();
  for (const p of prog) {
    startedUsers.add(p.user_id);
    if (p.completed) {
      const s = completedByUser.get(p.user_id) ?? new Set<string>();
      s.add(p.lesson_id);
      completedByUser.set(p.user_id, s);
    }
  }
  let completed = 0;
  for (const l of learners) if (totalLessons > 0 && (completedByUser.get(l.id)?.size ?? 0) >= totalLessons) completed++;

  // Per-learner average best quiz score.
  const bestByUserLesson = new Map<string, number>();
  for (const r of results) {
    const key = `${r.user_id}|${r.lesson_id}`;
    bestByUserLesson.set(key, Math.max(bestByUserLesson.get(key) ?? 0, r.score));
  }
  const perUserScores = new Map<string, number[]>();
  for (const [key, score] of bestByUserLesson) {
    const uid = key.split("|")[0];
    (perUserScores.get(uid) ?? perUserScores.set(uid, []).get(uid)!).push(score);
  }
  const userAvgs: number[] = [];
  for (const arr of perUserScores.values()) userAvgs.push(Math.round(arr.reduce((a, b) => a + b, 0) / arr.length));
  const avgScore = userAvgs.length ? Math.round(userAvgs.reduce((a, b) => a + b, 0) / userAvgs.length) : 0;

  // Per-lesson stats.
  const studied = new Map<string, Set<string>>();
  const compl = new Map<string, Set<string>>();
  const watchers = new Map<string, Set<string>>();
  for (const p of prog) {
    (studied.get(p.lesson_id) ?? studied.set(p.lesson_id, new Set()).get(p.lesson_id)!).add(p.user_id);
    if (p.completed) (compl.get(p.lesson_id) ?? compl.set(p.lesson_id, new Set()).get(p.lesson_id)!).add(p.user_id);
    if ((p.video_seconds ?? 0) > 0) (watchers.get(p.lesson_id) ?? watchers.set(p.lesson_id, new Set()).get(p.lesson_id)!).add(p.user_id);
  }
  const fails = new Map<string, number>();
  for (const r of results) if (!r.passed) fails.set(r.lesson_id, (fails.get(r.lesson_id) ?? 0) + 1);

  const lessonStats: LessonStat[] = lessons.map((l) => ({
    lessonId: l.id,
    title: lessonTitle.get(l.id) ?? l.title,
    studied: studied.get(l.id)?.size ?? 0,
    completed: compl.get(l.id)?.size ?? 0,
    failCount: fails.get(l.id) ?? 0,
    videoWatchers: watchers.get(l.id)?.size ?? 0,
  }));

  // Activity time series — last 30 days.
  const days: string[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const completionsByDay = new Map<string, number>();
  const attemptsByDay = new Map<string, number>();
  for (const p of prog) if (p.completed && p.completed_at) completionsByDay.set(dayKey(p.completed_at), (completionsByDay.get(dayKey(p.completed_at)) ?? 0) + 1);
  for (const r of results) if (r.submitted_at) attemptsByDay.set(dayKey(r.submitted_at), (attemptsByDay.get(dayKey(r.submitted_at)) ?? 0) + 1);
  const activity = days.map((date) => ({ date, completions: completionsByDay.get(date) ?? 0, attempts: attemptsByDay.get(date) ?? 0 }));

  return {
    totalLearners: learners.length,
    started: startedUsers.size,
    completed,
    passRate: learners.length ? Math.round((completed / learners.length) * 100) : 0,
    avgScore,
    totalLessons,
    lessonStats,
    activity,
  };
}

export async function getParticipantRows(courseId: string): Promise<ParticipantRow[]> {
  const learners = listLearners();
  const tree = await getCourseTree(courseId);
  const total = orderedLessons(tree).length;
  if (!dbEnabled) return [];

  const [{ data: progRows }, { data: resultRows }, { data: certRows }] = await Promise.all([
    db().from("elearning_progress").select("user_id,lesson_id,completed,last_viewed_at").eq("course_id", courseId),
    db().from("elearning_quiz_results").select("user_id,lesson_id,score").eq("course_id", courseId),
    db().from("elearning_certificates").select("user_id").eq("course_id", courseId),
  ]);
  const prog = (progRows ?? []) as any[];
  const results = (resultRows ?? []) as any[];
  const certified = new Set(((certRows ?? []) as any[]).map((c) => c.user_id));

  const completedByUser = new Map<string, Set<string>>();
  const lastByUser = new Map<string, string>();
  for (const p of prog) {
    if (p.completed) (completedByUser.get(p.user_id) ?? completedByUser.set(p.user_id, new Set()).get(p.user_id)!).add(p.lesson_id);
    if (p.last_viewed_at && (!lastByUser.get(p.user_id) || p.last_viewed_at > lastByUser.get(p.user_id)!)) lastByUser.set(p.user_id, p.last_viewed_at);
  }
  const bestByUserLesson = new Map<string, number>();
  for (const r of results) {
    const key = `${r.user_id}|${r.lesson_id}`;
    bestByUserLesson.set(key, Math.max(bestByUserLesson.get(key) ?? 0, r.score));
  }

  return learners
    .map((l) => {
      const done = completedByUser.get(l.id)?.size ?? 0;
      const pct = total ? Math.round((done / total) * 100) : 0;
      const scores: number[] = [];
      for (const [key, s] of bestByUserLesson) if (key.startsWith(`${l.id}|`)) scores.push(s);
      const status: LearnerStatus = pct >= 100 ? "done" : lastByUser.get(l.id) ? "learning" : "not_started";
      return {
        userId: l.id,
        name: l.name,
        jabatan: l.jabatan ?? l.department ?? "",
        completedLessons: done,
        totalLessons: total,
        pct,
        status,
        avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        lastActivity: lastByUser.get(l.id) ?? null,
        certified: certified.has(l.id),
      };
    })
    .sort((a, b) => b.pct - a.pct || a.name.localeCompare(b.name));
}

/** Essay answers awaiting manual review (needs_review results). */
export async function getEssayReviews(courseId: string): Promise<EssayReviewItem[]> {
  if (!dbEnabled) return [];
  const { data } = await db()
    .from("elearning_quiz_results")
    .select("id,user_id,lesson_id,quiz_id,score,answers,submitted_at,needs_review")
    .eq("course_id", courseId)
    .eq("needs_review", true)
    .order("submitted_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [];

  // Resolve essay prompts per quiz + lesson titles.
  const quizIds = [...new Set(rows.map((r) => r.quiz_id))];
  const lessonIds = [...new Set(rows.map((r) => r.lesson_id))];
  const [{ data: qRows }, { data: lRows }] = await Promise.all([
    db().from("elearning_questions").select("id,quiz_id,prompt,type").in("quiz_id", quizIds),
    db().from("elearning_lessons").select("id,title").in("id", lessonIds),
  ]);
  const essayByQuiz = new Map<string, { id: string; prompt: string }[]>();
  for (const q of ((qRows ?? []) as any[]).filter((q) => q.type === "essay")) {
    (essayByQuiz.get(q.quiz_id) ?? essayByQuiz.set(q.quiz_id, []).get(q.quiz_id)!).push({ id: q.id, prompt: q.prompt });
  }
  const titleById = new Map(((lRows ?? []) as any[]).map((l) => [l.id, l.title]));

  return rows.map((r) => {
    const essays = essayByQuiz.get(r.quiz_id) ?? [];
    const answers = (r.answers ?? {}) as Record<string, unknown>;
    return {
      resultId: r.id,
      userId: r.user_id,
      learnerName: getUser(r.user_id)?.name ?? r.user_id,
      lessonTitle: titleById.get(r.lesson_id) ?? "—",
      score: r.score,
      submittedAt: r.submitted_at,
      answers: essays.map((e) => ({ prompt: e.prompt, answer: typeof answers[e.id] === "string" ? (answers[e.id] as string) : "—" })),
    };
  });
}

/* ---------------- audit log ---------------- */

/** Append an audit record for a material change (append-only, never edited). */
export async function logElearningAudit(actorId: string, actorName: string, action: AuditAction, entity: AuditEntity, title: string): Promise<void> {
  if (!dbEnabled) return;
  markLocalWrite();
  await db()
    .from("elearning_audit")
    .insert({ id: `ela_${randomUUID()}`, actor_id: actorId, actor_name: actorName, action, entity, title: title.slice(0, 200) })
    .then(() => {}, () => {});
}

export async function listElearningAudit(limit = 60): Promise<ElearningAuditRow[]> {
  if (!dbEnabled) return [];
  const { data } = await db().from("elearning_audit").select("*").order("at", { ascending: false }).limit(limit);
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    actorName: r.actor_name ?? "",
    action: r.action,
    entity: r.entity,
    title: r.title ?? "",
    at: r.at,
  }));
}

/** Course completion for one learner (reuses the pure helper against the tree). */
export async function learnerCompletion(courseId: string, userId: string): Promise<number> {
  const tree = await getCourseTree(courseId);
  if (!dbEnabled) return 0;
  const { data } = await db().from("elearning_progress").select("lesson_id,completed").eq("course_id", courseId).eq("user_id", userId);
  const progress: Record<string, any> = {};
  for (const p of (data ?? []) as any[]) progress[p.lesson_id] = { completed: p.completed };
  return courseCompletion(tree, progress);
}
