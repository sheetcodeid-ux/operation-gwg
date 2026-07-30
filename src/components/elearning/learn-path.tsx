"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Download,
  FileText,
  Loader2,
  Lock,
  Play,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  courseCompletion,
  courseMinutes,
  courseStatus,
  fmtMinutes,
  lessonUnlocked,
  orderedLessons,
  resumeLessonId,
  LEARNER_STATUS_META,
  type ELearningCourse,
  type ELearningDay,
  type ELearningLesson,
  type LessonProgress,
  type QuizResultSummary,
} from "@/lib/elearning-shared";
import { completeLessonAction, getLessonDetailAction, saveLessonProgressAction } from "@/lib/actions/elearning";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { VideoPlayer } from "./video-player";
import { QuizRunner } from "./quiz-runner";
import { Award, ClipboardCheck, GraduationCap, RotateCcw } from "lucide-react";

export function LearnPath({
  course,
  days,
  progress,
  quizResults = {},
}: {
  course: ELearningCourse;
  days: ELearningDay[];
  progress: Record<string, LessonProgress>;
  quizResults?: Record<string, QuizResultSummary>;
  canManage?: boolean;
}) {
  const lessons = React.useMemo(() => orderedLessons(days), [days]);
  const completion = courseCompletion(days, progress);
  const status = courseStatus(days, progress);
  const totalMin = courseMinutes(days);
  const doneCount = lessons.filter((l) => progress[l.id]?.completed).length;

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const activeIndex = activeId ? lessons.findIndex((l) => l.id === activeId) : -1;
  const activeLesson = activeIndex >= 0 ? lessons[activeIndex] : null;

  const openLesson = (id: string) => {
    const idx = lessons.findIndex((l) => l.id === id);
    if (idx < 0) return;
    if (!lessonUnlocked(lessons, idx, progress)) {
      toast.error("Selesaikan materi sebelumnya dulu untuk membuka materi ini.");
      return;
    }
    setActiveId(id);
  };

  // Next lesson id after the active one (for auto-advance). Just completed, so we
  // open it directly without re-checking the (stale) unlock state.
  const nextLessonId = activeIndex >= 0 && activeIndex < lessons.length - 1 ? lessons[activeIndex + 1].id : null;

  const resumeId = resumeLessonId(days, progress);
  const st = LEARNER_STATUS_META[status];

  return (
    <div className="w-full space-y-5">
      {/* Hero */}
      <div className="card-gradient animate-fade-up relative overflow-hidden rounded-2xl">
        <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-500/25 dark:text-brand-400">
                <GraduationCap className="size-3.5" /> E-Learning
              </span>
              {course.category && <Badge tone="cyan">{course.category}</Badge>}
              <Badge tone={st.tone}>{st.label}</Badge>
            </div>
            <h1 className="text-gradient-brand mt-2.5 text-2xl font-bold tracking-tight sm:text-3xl">{course.title}</h1>
            {course.description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{course.description}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <MetaChip icon={PlayCircle}>{lessons.length} materi · {days.length} hari</MetaChip>
              <MetaChip icon={Clock}>Estimasi {fmtMinutes(totalMin)}</MetaChip>
              <MetaChip icon={CheckCircle2}>{doneCount}/{lessons.length} selesai</MetaChip>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-3">
            <ProgressRing pct={completion} />
            {resumeId && completion < 100 && (
              <Button onClick={() => openLesson(resumeId)} className="w-full shadow-lg shadow-brand-500/20">
                <Play className="size-4" /> {doneCount === 0 ? "Mulai Belajar" : "Lanjutkan"}
              </Button>
            )}
            {completion >= 100 && (
              <>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400">
                  <Sparkles className="size-4" /> Semua materi selesai
                </span>
                <Link href="/elearning/sertifikat" className="w-full">
                  <Button variant="outline" className="w-full"><Award className="size-4" /> Lihat Sertifikat</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Learning path by day */}
      <div className="space-y-3">
        {days.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Belum ada materi pada course ini.
          </div>
        ) : (
          days
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((day, di) => (
              <DaySection
                key={day.id}
                day={day}
                index={di}
                defaultOpen={di === 0 || day.lessons.some((l) => l.id === resumeId)}
                lessons={lessons}
                progress={progress}
                quizResults={quizResults}
                onOpen={openLesson}
              />
            ))
        )}
      </div>

      <Dialog open={!!activeLesson} onOpenChange={(v) => !v && setActiveId(null)}>
        {activeLesson && (
          <DialogContent title={activeLesson.title} description={`Materi ${activeIndex + 1} dari ${lessons.length}`} align="center" className="max-w-3xl">
            <LessonViewer
              courseId={course.id}
              lessonMeta={activeLesson}
              alreadyDone={!!progress[activeLesson.id]?.completed}
              savedSeconds={progress[activeLesson.id]?.videoSeconds ?? 0}
              hasNext={!!nextLessonId}
              onNext={() => nextLessonId && setActiveId(nextLessonId)}
              onClose={() => setActiveId(null)}
            />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

/** A small pill of metadata for the hero. */
function MetaChip({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-background/50 px-2.5 py-1.5 text-xs text-muted-foreground ring-1 ring-border">
      <Icon className="size-3.5" /> {children}
    </span>
  );
}

/** Circular completion ring (no external dep). */
function ProgressRing({ pct }: { pct: number }) {
  const size = 92;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, pct)) / 100) * c;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeDasharray={`${dash} ${c}`} strokeLinecap="round" className="stroke-brand-500 transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="text-lg font-semibold tabular-nums text-foreground">{pct}%</span>
        <span className="text-[10px] text-muted-foreground">selesai</span>
      </div>
    </div>
  );
}

function DaySection({
  day,
  index,
  defaultOpen,
  lessons,
  progress,
  quizResults,
  onOpen,
}: {
  day: ELearningDay;
  index: number;
  defaultOpen: boolean;
  lessons: ELearningLesson[];
  progress: Record<string, LessonProgress>;
  quizResults: Record<string, QuizResultSummary>;
  onOpen: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const dayLessons = day.lessons.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const doneInDay = dayLessons.filter((l) => progress[l.id]?.completed).length;
  const dayPct = dayLessons.length ? Math.round((doneInDay / dayLessons.length) * 100) : 0;
  const dayComplete = dayLessons.length > 0 && doneInDay === dayLessons.length;

  return (
    <div className="card-gradient animate-fade-up overflow-hidden rounded-xl" style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/20">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold ring-1 transition-colors", dayComplete ? "bg-brand-500/15 text-brand-700 ring-brand-500/30 dark:text-brand-400" : "bg-muted text-foreground ring-border")}>
          {dayComplete ? <CheckCircle2 className="size-5 text-brand-500" /> : index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{day.title}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${dayPct}%` }} /></div>
            <span className="text-[11px] tabular-nums text-muted-foreground">{doneInDay}/{dayLessons.length}</span>
          </div>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-border p-2.5">
          {dayLessons.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">Belum ada materi.</p>
          ) : (
            dayLessons.map((l) => {
              const globalIndex = lessons.findIndex((x) => x.id === l.id);
              const unlocked = lessonUnlocked(lessons, globalIndex, progress);
              const done = !!progress[l.id]?.completed;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onOpen(l.id)}
                  disabled={!unlocked}
                  className={cn(
                    "group/lesson flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all",
                    done ? "border-brand-500/30 bg-brand-500/[0.06]" : "border-border bg-background/40",
                    unlocked ? "hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-md hover:shadow-black/5" : "cursor-not-allowed opacity-55",
                  )}
                >
                  {/* Thumbnail / status tile */}
                  <span className={cn("relative grid aspect-video w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br", done ? "from-brand-500/20 to-brand-500/5" : "from-muted to-muted/40")}>
                    {l.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
                    ) : null}
                    <span className={cn("relative grid size-7 place-items-center rounded-full", l.thumbnailUrl ? "bg-black/45 text-white backdrop-blur-sm" : "text-muted-foreground")}>
                      {done ? <CheckCircle2 className="size-4 text-brand-400" /> : !unlocked ? <Lock className="size-4" /> : l.hasVideo ? <Play className="size-4 translate-x-0.5" fill="currentColor" /> : <Circle className="size-4" />}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{l.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      {l.required && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">Wajib</span>}
                      {l.estimatedMinutes > 0 && <span className="inline-flex items-center gap-0.5"><Clock className="size-3" /> {fmtMinutes(l.estimatedMinutes)}</span>}
                      {l.hasVideo && <span className="inline-flex items-center gap-0.5"><PlayCircle className="size-3" /> Video</span>}
                      {l.fileCount > 0 && <span>{l.fileCount} lampiran</span>}
                      {l.hasQuiz && (
                        <span className={cn("inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium", quizResults[l.id]?.passed ? "bg-brand-500/10 text-brand-600 dark:text-brand-400" : quizResults[l.id] ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground")}>
                          <ClipboardCheck className="size-3" />
                          {quizResults[l.id]?.passed ? `Lulus ${quizResults[l.id].score}` : quizResults[l.id] ? `Ulangi (${quizResults[l.id].score})` : "Assessment"}
                        </span>
                      )}
                    </div>
                  </div>
                  {unlocked ? (
                    <ChevronDown className="size-4 shrink-0 -rotate-90 text-muted-foreground/50 transition-transform group-hover/lesson:translate-x-0.5" />
                  ) : (
                    <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/** Loads the lesson detail (signed video + files) and plays it, with resume,
 *  must-complete gating, and a "Tandai Selesai" action. */
function LessonViewer({
  courseId,
  lessonMeta,
  alreadyDone,
  savedSeconds,
  hasNext,
  onNext,
  onClose,
}: {
  courseId: string;
  lessonMeta: ELearningLesson;
  alreadyDone: boolean;
  savedSeconds: number;
  hasNext: boolean;
  onNext: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [lesson, setLesson] = React.useState<ELearningLesson | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [videoDone, setVideoDone] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [quizMode, setQuizMode] = React.useState(false);

  React.useEffect(() => {
    let live = true;
    setLoading(true);
    setVideoDone(false);
    setQuizMode(false);
    getLessonDetailAction(lessonMeta.id).then((r) => {
      if (!live) return;
      if (r.ok) setLesson(r.lesson);
      else toast.error(r.error);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [lessonMeta.id]);

  const saveProgress = React.useCallback(
    (videoSeconds: number, completedVideo?: boolean) => {
      void saveLessonProgressAction({ courseId, lessonId: lessonMeta.id, videoSeconds: Math.floor(videoSeconds), videoCompleted: completedVideo });
    },
    [courseId, lessonMeta.id],
  );

  const requireVideo = lessonMeta.mustCompleteVideo && lessonMeta.hasVideo;
  const canComplete = !requireVideo || videoDone || alreadyDone;

  const handleQuizPassed = () => {
    router.refresh();
    if (hasNext) onNext();
    else onClose();
  };

  const markDone = () => {
    setSaving(true);
    completeLessonAction({ courseId, lessonId: lessonMeta.id })
      .then((r) => {
        if (r?.error) {
          toast.error(r.error);
          return;
        }
        router.refresh();
        if (hasNext) {
          toast.success("Materi selesai — lanjut ke materi berikutnya.");
          onNext();
        } else {
          toast.success("Selamat! Anda menyelesaikan seluruh materi.");
          onClose();
        }
      })
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Memuat materi…
      </div>
    );
  }
  if (!lesson) return <div className="p-8 text-center text-sm text-muted-foreground">Materi tidak dapat dimuat.</div>;

  if (quizMode && lesson.quiz) {
    return <QuizRunner lessonId={lessonMeta.id} quiz={lesson.quiz} onPassed={handleQuizPassed} onClose={() => setQuizMode(false)} />;
  }

  const hasQuiz = !!lesson.quiz && lesson.quiz.questions.length > 0;
  const canStartQuiz = !requireVideo || videoDone || alreadyDone;

  return (
    <div className="max-h-[80vh] space-y-4 overflow-y-auto p-5">
      {lesson.videoUrl ? (
        <VideoPlayer
          src={lesson.videoUrl}
          poster={lesson.thumbnailUrl}
          subtitleUrl={lesson.subtitleUrl}
          startSeconds={savedSeconds}
          requireFullWatch={requireVideo}
          onProgress={(s) => saveProgress(s)}
          onVideoComplete={() => {
            if (!videoDone) {
              setVideoDone(true);
              void saveLessonProgressAction({ courseId, lessonId: lessonMeta.id, videoCompleted: true });
            }
          }}
        />
      ) : lesson.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lesson.thumbnailUrl} alt={lesson.title} className="w-full rounded-xl border border-border object-cover" />
      ) : null}

      {requireVideo && !canComplete && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Materi ini mewajibkan menonton video sampai selesai (tidak dapat dilompati) sebelum ditandai selesai.
        </p>
      )}

      {lesson.description && <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{lesson.description}</p>}

      {lesson.files && lesson.files.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Materi & Lampiran</p>
          {lesson.files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-2.5">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{f.name}</span>
              {f.url && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <a href={f.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="subtle">Lihat</Button>
                  </a>
                  {f.downloadable && (
                    <a href={f.url} download={f.name}>
                      <Button size="sm" variant="ghost"><Download className="size-4" /></Button>
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">
          {alreadyDone
            ? "Sudah selesai — bisa ditinjau ulang kapan saja."
            : hasQuiz
              ? "Selesaikan Assessment untuk menyelesaikan materi ini."
              : lesson.required
                ? "Materi wajib"
                : "Materi opsional"}
        </span>
        {alreadyDone ? (
          <div className="flex gap-2">
            {hasQuiz && <Button variant="outline" onClick={() => setQuizMode(true)}><RotateCcw className="size-4" /> Ulangi</Button>}
            <Button variant="outline" onClick={onClose}>Tutup</Button>
            {hasNext && <Button onClick={onNext}>Materi Berikutnya</Button>}
          </div>
        ) : hasQuiz ? (
          <Button onClick={() => setQuizMode(true)} disabled={!canStartQuiz}>
            <ClipboardCheck className="size-4" /> Mulai Assessment
          </Button>
        ) : (
          <Button onClick={markDone} disabled={!canComplete || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} {hasNext ? "Selesai & Lanjut" : "Tandai Selesai"}
          </Button>
        )}
      </div>
    </div>
  );
}
