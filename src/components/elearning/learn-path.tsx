"use client";

import * as React from "react";
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
import { ClipboardCheck, RotateCcw } from "lucide-react";

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
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-brand-500/10 via-card to-card">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {course.category && <Badge tone="cyan">{course.category}</Badge>}
              <Badge tone={st.tone}>{st.label}</Badge>
            </div>
            <h1 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">{course.title}</h1>
            {course.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{course.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><PlayCircle className="size-4" /> {lessons.length} materi · {days.length} hari</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="size-4" /> Estimasi {fmtMinutes(totalMin)}</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4" /> {doneCount}/{lessons.length} selesai</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-3">
            <ProgressRing pct={completion} />
            {resumeId && completion < 100 && (
              <Button onClick={() => openLesson(resumeId)} className="w-full">
                <Play className="size-4" /> {doneCount === 0 ? "Mulai Belajar" : "Lanjutkan"}
              </Button>
            )}
            {completion >= 100 && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400">
                <Sparkles className="size-4" /> Semua materi selesai
              </span>
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

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/30">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-sm font-semibold text-brand-700 dark:text-brand-400">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{day.title}</p>
          <p className="truncate text-xs text-muted-foreground">{doneInDay}/{dayLessons.length} materi selesai{day.description ? ` · ${day.description}` : ""}</p>
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
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    done ? "border-brand-500/30 bg-brand-500/5" : "border-border bg-background/40",
                    unlocked ? "hover:bg-muted/40" : "cursor-not-allowed opacity-60",
                  )}
                >
                  <span className="shrink-0">
                    {done ? <CheckCircle2 className="size-5 text-brand-500" /> : !unlocked ? <Lock className="size-5 text-muted-foreground" /> : l.hasVideo ? <PlayCircle className="size-5 text-muted-foreground" /> : <Circle className="size-5 text-muted-foreground" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{l.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {l.required && <span className="font-medium text-amber-600 dark:text-amber-400">Wajib</span>}
                      {l.estimatedMinutes > 0 && <span>· {fmtMinutes(l.estimatedMinutes)}</span>}
                      {l.hasVideo && <span>· Video</span>}
                      {l.fileCount > 0 && <span>· {l.fileCount} lampiran</span>}
                      {l.hasQuiz && (
                        <span className="inline-flex items-center gap-0.5">
                          · <ClipboardCheck className="size-3" />
                          {quizResults[l.id]?.passed
                            ? `Lulus ${quizResults[l.id].score}`
                            : quizResults[l.id]
                              ? `Belum lulus (${quizResults[l.id].score})`
                              : "Assessment"}
                        </span>
                      )}
                    </div>
                  </div>
                  {!unlocked && <span className="shrink-0 text-[11px] text-muted-foreground">Terkunci</span>}
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
