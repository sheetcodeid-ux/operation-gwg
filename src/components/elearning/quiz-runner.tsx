"use client";

import * as React from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, ClipboardCheck, Clock, Loader2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  isAnswered,
  shuffled,
  TRUE_FALSE_OPTIONS,
  type PublicQuiz,
  type QuizAnswer,
  type QuizAnswers,
  type QuizOption,
  type QuizQuestionPublic,
} from "@/lib/elearning-quiz";
import { submitQuizAction, type QuizSubmitResult } from "@/lib/actions/elearning";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";

interface PreparedQuestion extends QuizQuestionPublic {
  displayOptions: QuizOption[];
}

function prepare(quiz: PublicQuiz): PreparedQuestion[] {
  const qs = quiz.shuffleQuestions ? shuffled(quiz.questions) : [...quiz.questions].sort((a, b) => a.sortOrder - b.sortOrder);
  return qs.map((q) => {
    const opts = q.type === "truefalse" ? TRUE_FALSE_OPTIONS : q.options;
    // Order questions are always shuffled (the task is to sort them); others honor the setting.
    const display = q.type === "order" ? shuffled(opts) : quiz.shuffleAnswers && q.type !== "essay" ? shuffled(opts) : opts;
    return { ...q, displayOptions: display };
  });
}

export function QuizRunner({
  lessonId,
  quiz,
  onPassed,
  onClose,
}: {
  lessonId: string;
  quiz: PublicQuiz;
  onPassed: () => void;
  onClose: () => void;
}) {
  const [questions] = React.useState<PreparedQuestion[]>(() => prepare(quiz));
  const [answers, setAnswers] = React.useState<QuizAnswers>(() => {
    // Order questions start in their displayed (shuffled) order.
    const init: QuizAnswers = {};
    for (const q of prepare(quiz)) if (q.type === "order") init[q.id] = q.displayOptions.map((o) => o.id);
    return init;
  });
  const startedAt = React.useRef(new Date().toISOString());
  const [remaining, setRemaining] = React.useState(quiz.timeLimitSec > 0 ? quiz.timeLimitSec : 0);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<QuizSubmitResult | null>(null);

  const setAns = (qid: string, v: QuizAnswer) => setAnswers((a) => ({ ...a, [qid]: v }));

  const submit = React.useCallback(
    (auto = false) => {
      if (submitting || result) return;
      if (!auto) {
        const unanswered = questions.filter((q) => !isAnswered(q, answers[q.id])).length;
        if (unanswered > 0 && !window.confirm(`${unanswered} soal belum dijawab. Kirim sekarang?`)) return;
      }
      setSubmitting(true);
      submitQuizAction({ lessonId, answers, startedAt: startedAt.current })
        .then((r) => {
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          setResult(r.result);
          if (r.result.passed) toast.success(`Lulus! Skor ${r.result.score}.`);
        })
        .finally(() => setSubmitting(false));
    },
    [submitting, result, questions, answers, lessonId],
  );

  // Countdown → auto-submit at zero.
  React.useEffect(() => {
    if (quiz.timeLimitSec <= 0 || result) return;
    const t = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          clearInterval(t);
          submit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.timeLimitSec, result]);

  if (result) return <ResultView result={result} onPassed={onPassed} onClose={onClose} onRetry={() => window.location.reload()} />;

  const answeredCount = questions.filter((q) => isAnswered(q, answers[q.id])).length;

  return (
    <div className="max-h-[80vh] space-y-4 overflow-y-auto p-5">
      <div className="sticky -top-5 z-10 -mx-5 -mt-5 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2 text-sm">
          <ClipboardCheck className="size-4 text-brand-500" />
          <span className="font-semibold text-foreground">{quiz.title}</span>
          <span className="text-muted-foreground">· {answeredCount}/{questions.length} terjawab</span>
        </div>
        {quiz.timeLimitSec > 0 && (
          <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums", remaining <= 30 ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-muted text-foreground")}>
            <Clock className="size-4" /> {Math.floor(remaining / 60)}:{(remaining % 60).toString().padStart(2, "0")}
          </span>
        )}
      </div>

      {questions.map((q, i) => (
        <QuestionCard key={q.id} index={i} q={q} answer={answers[q.id]} onChange={(v) => setAns(q.id, v)} />
      ))}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">Nilai lulus minimal {quiz.passScore}. Jawaban & soal diacak.</span>
        <Button onClick={() => submit(false)} disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Kirim Jawaban
        </Button>
      </div>
    </div>
  );
}

function QuestionCard({ index, q, answer, onChange }: { index: number; q: PreparedQuestion; answer: QuizAnswer | undefined; onChange: (v: QuizAnswer) => void }) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <div className="mb-2 flex items-start gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-brand-500/10 text-xs font-semibold text-brand-700 dark:text-brand-400">{index + 1}</span>
        <div className="min-w-0">
          {q.scenario && <p className="mb-1 whitespace-pre-line rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{q.scenario}</p>}
          <p className="text-sm font-medium text-foreground">{q.prompt}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {q.type === "multiple" ? "Pilih semua yang benar" : q.type === "order" ? "Susun urutan yang benar" : q.type === "essay" ? "Jawaban uraian" : "Pilih satu jawaban"} · {q.points} poin
          </p>
        </div>
      </div>

      {q.type === "essay" ? (
        <Textarea rows={4} value={typeof answer === "string" ? answer : ""} onChange={(e) => onChange(e.target.value)} placeholder="Tulis jawaban Anda…" />
      ) : q.type === "order" ? (
        <OrderInput ids={Array.isArray(answer) ? answer : q.displayOptions.map((o) => o.id)} options={q.displayOptions} onChange={onChange} />
      ) : q.type === "multiple" ? (
        <div className="space-y-1.5">
          {q.displayOptions.map((o) => {
            const arr = Array.isArray(answer) ? answer : [];
            const checked = arr.includes(o.id);
            return (
              <label key={o.id} className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-sm", checked ? "border-brand-500/50 bg-brand-500/5" : "border-border hover:bg-muted/40")}>
                <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked ? [...arr, o.id] : arr.filter((x) => x !== o.id))} className="size-4 accent-brand-500" />
                <span className="text-foreground">{o.text}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {q.displayOptions.map((o) => {
            const checked = answer === o.id;
            return (
              <label key={o.id} className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-sm", checked ? "border-brand-500/50 bg-brand-500/5" : "border-border hover:bg-muted/40")}>
                <input type="radio" name={q.id} checked={checked} onChange={() => onChange(o.id)} className="size-4 accent-brand-500" />
                <span className="text-foreground">{o.text}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Orderable list: up/down arrows arrange the steps; answer is the current id order. */
function OrderInput({ ids, options, onChange }: { ids: string[]; options: QuizOption[]; onChange: (v: string[]) => void }) {
  const byId = new Map(options.map((o) => [o.id, o]));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-1.5">
      {ids.map((id, i) => (
        <div key={id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-foreground">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{byId.get(id)?.text ?? id}</span>
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted/60 disabled:opacity-30"><ArrowUp className="size-4" /></button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === ids.length - 1} className="grid size-7 place-items-center rounded text-muted-foreground hover:bg-muted/60 disabled:opacity-30"><ArrowDown className="size-4" /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ResultView({ result, onPassed, onClose, onRetry }: { result: QuizSubmitResult; onPassed: () => void; onClose: () => void; onRetry: () => void }) {
  const pass = result.passed;
  return (
    <div className="space-y-5 p-8 text-center">
      <div className="mx-auto grid size-20 place-items-center rounded-full" style={{ background: pass ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)" }}>
        {pass ? <CheckCircle2 className="size-10 text-brand-500" /> : <XCircle className="size-10 text-red-500" />}
      </div>
      <div>
        <p className="text-3xl font-bold tabular-nums text-foreground">{result.score}</p>
        <p className="mt-1 text-sm text-muted-foreground">Nilai lulus minimal {result.passScore}</p>
      </div>
      <Badge tone={pass ? "success" : "danger"}>{pass ? "LULUS" : "BELUM LULUS"}</Badge>
      {result.needsReview && (
        <p className="mx-auto flex max-w-sm items-center justify-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-4" /> Terdapat soal essay yang akan dinilai manual oleh Head Operational.
        </p>
      )}
      <div className="flex justify-center gap-2 pt-2">
        {pass ? (
          <Button onClick={onPassed}><CheckCircle2 className="size-4" /> Lanjutkan</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>Tutup</Button>
            <Button onClick={onRetry}><RotateCcw className="size-4" /> Ulangi Assessment</Button>
          </>
        )}
      </div>
    </div>
  );
}
