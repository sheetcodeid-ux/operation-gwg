"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ClipboardCheck, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  QUESTION_TYPES,
  QUESTION_TYPE_LABEL,
  type AdminQuiz,
  type QuestionType,
  type QuizOption,
  type QuizQuestion,
} from "@/lib/elearning-quiz";
import {
  addQuestionAction,
  deleteQuestionAction,
  deleteQuizAction,
  getQuizAdminAction,
  reorderQuestionsAction,
  saveQuizSettingsAction,
  updateQuestionAction,
} from "@/lib/actions/elearning";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Field, Input, Textarea } from "@/components/ui/input";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { FASE_KUIS, LABEL_FASE, PENJELASAN_FASE, type FaseKuis } from "@/lib/elearning-fase";

const rid = () => Math.random().toString(36).slice(2, 8);

/**
 * Penyunting soal — satu jendela untuk KETIGA tahap sebuah materi.
 *
 * Tahapnya dipilih lewat tab di dalam, bukan tiga tombol terpisah di daftar
 * materi. Yang menyusun materi memikirkan satu materi utuh: soal pembukanya,
 * kasusnya, lalu ujiannya. Tiga pintu masuk membuat ia harus mengingat sendiri
 * mana yang sudah diisi dan mana yang belum.
 */
export function QuizEditor({ courseId, lessonId, open, onOpenChange }: { courseId: string; lessonId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [fase, setFase] = React.useState<FaseKuis>("pre");
  const [quiz, setQuiz] = React.useState<AdminQuiz | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [editing, setEditing] = React.useState<QuizQuestion | "new" | null>(null);
  const [settings, setSettings] = React.useState({ title: LABEL_FASE.pre, timeLimitMin: 0, passScore: 70, shuffleQuestions: true, shuffleAnswers: true });

  const reload = React.useCallback(async () => {
    const r = await getQuizAdminAction(lessonId, fase);
    if (!r.ok) return;
    setQuiz(r.quiz);
    // Tahap yang belum pernah dibuat tetap perlu pengaturan awal yang masuk
    // akal, bukan sisa pengaturan tahap yang barusan dibuka.
    setSettings(
      r.quiz
        ? {
            title: r.quiz.title,
            timeLimitMin: Math.round(r.quiz.timeLimitSec / 60),
            passScore: r.quiz.passScore,
            shuffleQuestions: r.quiz.shuffleQuestions,
            shuffleAnswers: r.quiz.shuffleAnswers,
          }
        : { title: LABEL_FASE[fase], timeLimitMin: 0, passScore: 70, shuffleQuestions: true, shuffleAnswers: true },
    );
  }, [lessonId, fase]);

  React.useEffect(() => {
    if (!open) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [open, reload]);

  const saveSettings = () => {
    setSavingSettings(true);
    saveQuizSettingsAction({ courseId, lessonId, fase, title: settings.title, timeLimitSec: settings.timeLimitMin * 60, passScore: settings.passScore, shuffleQuestions: settings.shuffleQuestions, shuffleAnswers: settings.shuffleAnswers })
      .then((r) => {
        if (r?.error) return toast.error(r.error);
        toast.success(`Pengaturan ${LABEL_FASE[fase]} disimpan.`);
        reload();
        router.refresh();
      })
      .finally(() => setSavingSettings(false));
  };

  const removeQuiz = () => {
    if (!quiz) return;
    if (!window.confirm(`Hapus seluruh soal ${LABEL_FASE[fase]} untuk materi ini?`)) return;
    deleteQuizAction(quiz.id).then((r) => {
      if (r?.error) return toast.error(r.error);
      toast.success(`${LABEL_FASE[fase]} dihapus.`);
      setQuiz(null);
      router.refresh();
    });
  };

  const move = (i: number, dir: -1 | 1) => {
    if (!quiz) return;
    const next = i + dir;
    if (next < 0 || next >= quiz.questions.length) return;
    const ids = quiz.questions.map((q) => q.id);
    [ids[i], ids[next]] = [ids[next], ids[i]];
    reorderQuestionsAction(ids).then(() => reload());
  };

  const del = (id: string) => {
    if (!window.confirm("Hapus soal ini?")) return;
    deleteQuestionAction(id).then((r) => {
      if (r?.error) return toast.error(r.error);
      reload();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Soal Materi"
        description="Pre Test dikerjakan sebelum belajar, Post Test setelah materinya tuntas. Soal & jawaban diacak otomatis."
        align="center"
        className="max-w-2xl"
      >
        <div className="border-b border-border px-5 pt-4">
          <SegmentedTabs
            size="sm"
            value={fase}
            onChange={(v) => setFase(v as FaseKuis)}
            items={FASE_KUIS.map((f) => ({ value: f, label: LABEL_FASE[f] }))}
          />
          <p className="mt-2 pb-3 text-[11px] leading-relaxed text-muted-foreground">{PENJELASAN_FASE[fase]}</p>
        </div>
        <div className="max-h-[78vh] space-y-4 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memuat…</div>
          ) : (
            <>
              {/* Settings */}
              <div className="space-y-3 rounded-xl border border-border p-4">
                <Field label="Judul"><Input value={settings.title} onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Batas Waktu (menit)" hint="0 = tanpa batas"><Input type="number" min={0} value={settings.timeLimitMin} onChange={(e) => setSettings((s) => ({ ...s, timeLimitMin: Number(e.target.value) }))} /></Field>
                  <Field label="Nilai Kelulusan (%)"><Input type="number" min={0} max={100} value={settings.passScore} onChange={(e) => setSettings((s) => ({ ...s, passScore: Number(e.target.value) }))} /></Field>
                </div>
                <div className="flex flex-wrap gap-4">
                  <Toggle label="Acak urutan soal" checked={settings.shuffleQuestions} onChange={(v) => setSettings((s) => ({ ...s, shuffleQuestions: v }))} />
                  <Toggle label="Acak urutan jawaban" checked={settings.shuffleAnswers} onChange={(v) => setSettings((s) => ({ ...s, shuffleAnswers: v }))} />
                </div>
                <div className="flex justify-end gap-2">
                  {quiz && <Button variant="ghost" className="text-red-600 dark:text-red-400" onClick={removeQuiz}><Trash2 className="size-4" /> Hapus {LABEL_FASE[fase]}</Button>}
                  <Button onClick={saveSettings} disabled={savingSettings}>{savingSettings && <Loader2 className="size-4 animate-spin" />} Simpan Pengaturan</Button>
                </div>
              </div>

              {/* Questions */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Soal {quiz ? `(${quiz.questions.length})` : ""}</p>
                <Button size="sm" onClick={() => setEditing("new")}><Plus className="size-4" /> Tambah Soal</Button>
              </div>

              {!quiz || quiz.questions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Belum ada soal. Simpan pengaturan lalu tambah soal.</p>
              ) : (
                <div className="space-y-1.5">
                  {quiz.questions.map((q, i) => (
                    <div key={q.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-2.5">
                      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-foreground">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{q.prompt || <span className="text-muted-foreground">(tanpa teks)</span>}</p>
                        <p className="text-[11px] text-muted-foreground">{QUESTION_TYPE_LABEL[q.type]} · {q.points} poin</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <IconBtn title="Naik" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></IconBtn>
                        <IconBtn title="Turun" disabled={i === quiz.questions.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></IconBtn>
                        <IconBtn title="Edit" onClick={() => setEditing(q)}><Pencil className="size-4" /></IconBtn>
                        <IconBtn title="Hapus" danger onClick={() => del(q.id)}><Trash2 className="size-4" /></IconBtn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>

      {editing && (
        <QuestionEditor
          courseId={courseId}
          lessonId={lessonId}
          fase={fase}
          question={editing === "new" ? null : editing}
          onSaved={() => {
            setEditing(null);
            reload();
            router.refresh();
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </Dialog>
  );
}

interface QForm {
  type: QuestionType;
  prompt: string;
  scenario: string;
  points: number;
  options: QuizOption[];
  correctSingle: string;
  correctMulti: string[];
}

function QuestionEditor({ courseId, lessonId, fase, question, onSaved, onClose }: { courseId: string; lessonId: string; fase: FaseKuis; question: QuizQuestion | null; onSaved: () => void; onClose: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const [f, setF] = React.useState<QForm>(() => init(question));

  function init(q: QuizQuestion | null): QForm {
    if (!q) return { type: "single", prompt: "", scenario: "", points: 1, options: [{ id: rid(), text: "" }, { id: rid(), text: "" }], correctSingle: "", correctMulti: [] };
    return {
      type: q.type,
      prompt: q.prompt,
      scenario: q.scenario,
      points: q.points,
      options: q.options.length ? q.options : [{ id: rid(), text: "" }, { id: rid(), text: "" }],
      correctSingle: typeof q.correct === "string" ? q.correct : "",
      correctMulti: Array.isArray(q.correct) ? q.correct : [],
    };
  }

  const set = <K extends keyof QForm>(k: K, v: QForm[K]) => setF((s) => ({ ...s, [k]: v }));
  const usesOptions = ["single", "multiple", "case", "order"].includes(f.type);

  const setOption = (id: string, text: string) => set("options", f.options.map((o) => (o.id === id ? { ...o, text } : o)));
  const addOption = () => set("options", [...f.options, { id: rid(), text: "" }]);
  const removeOption = (id: string) => set("options", f.options.filter((o) => o.id !== id));
  const moveOption = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= f.options.length) return;
    const next = [...f.options];
    [next[i], next[j]] = [next[j], next[i]];
    set("options", next);
  };

  const save = () => {
    if (!f.prompt.trim()) return toast.error("Pertanyaan wajib diisi.");
    const cleanOpts = f.options.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text);
    let correct: QuizQuestion["correct"] = null;
    if (f.type === "single" || f.type === "case") {
      if (!f.correctSingle || !cleanOpts.some((o) => o.id === f.correctSingle)) return toast.error("Pilih satu jawaban benar.");
      correct = f.correctSingle;
    } else if (f.type === "truefalse") {
      if (f.correctSingle !== "true" && f.correctSingle !== "false") return toast.error("Pilih Benar atau Salah.");
      correct = f.correctSingle;
    } else if (f.type === "multiple") {
      const valid = f.correctMulti.filter((id) => cleanOpts.some((o) => o.id === id));
      if (valid.length === 0) return toast.error("Tandai minimal satu jawaban benar.");
      correct = valid;
    } else if (f.type === "order") {
      if (cleanOpts.length < 2) return toast.error("Minimal 2 langkah untuk soal urutan.");
      correct = cleanOpts.map((o) => o.id); // current order = correct order
    }
    if (usesOptions && f.type !== "order" && cleanOpts.length < 2) return toast.error("Minimal 2 opsi jawaban.");

    const payload: Omit<QuizQuestion, "id" | "sortOrder"> = {
      type: f.type,
      prompt: f.prompt.trim(),
      scenario: f.type === "case" ? f.scenario.trim() : "",
      points: Math.max(1, Math.round(f.points || 1)),
      options: f.type === "truefalse" || f.type === "essay" ? [] : cleanOpts,
      correct,
    };
    setBusy(true);
    const p = question ? updateQuestionAction(question.id, payload) : addQuestionAction({ courseId, lessonId, fase, question: payload });
    p.then((r) => {
      if (r && "error" in r && r.error) return toast.error(r.error);
      toast.success(question ? "Soal diperbarui." : "Soal ditambahkan.");
      onSaved();
    }).finally(() => setBusy(false));
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={question ? "Edit Soal" : "Tambah Soal"} align="center" className="max-w-lg">
        <div className="max-h-[76vh] space-y-3 overflow-y-auto p-5">
          <Field label="Jenis Soal">
            <Combobox value={f.type} onChange={(v) => set("type", v as QuestionType)} options={QUESTION_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
          </Field>
          <p className="-mt-1 text-[11px] text-muted-foreground">{QUESTION_TYPES.find((t) => t.value === f.type)?.hint}</p>

          {f.type === "case" && (
            <Field label="Skenario / Konteks"><Textarea rows={3} value={f.scenario} onChange={(e) => set("scenario", e.target.value)} placeholder="Ceritakan situasi studi kasus…" /></Field>
          )}

          <Field label="Pertanyaan"><Textarea rows={2} value={f.prompt} onChange={(e) => set("prompt", e.target.value)} placeholder="Tulis pertanyaan…" /></Field>
          <Field label="Poin"><Input type="number" min={1} value={f.points} onChange={(e) => set("points", Number(e.target.value))} className="w-28" /></Field>

          {f.type === "truefalse" && (
            <Field label="Jawaban Benar">
              <div className="flex gap-2">
                {[{ id: "true", t: "Benar" }, { id: "false", t: "Salah" }].map((o) => (
                  <button key={o.id} type="button" onClick={() => set("correctSingle", o.id)} className={cn("flex-1 rounded-lg border p-2.5 text-sm", f.correctSingle === o.id ? "border-brand-500 bg-brand-500/10 text-brand-700 dark:text-brand-400" : "border-border")}>{o.t}</button>
                ))}
              </div>
            </Field>
          )}

          {usesOptions && (
            <Field label={f.type === "order" ? "Langkah (urutkan sesuai jawaban benar)" : f.type === "multiple" ? "Opsi (centang yang benar)" : "Opsi (pilih yang benar)"}>
              <div className="space-y-1.5">
                {f.options.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-2">
                    {f.type === "order" ? (
                      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-xs font-semibold text-foreground">{i + 1}</span>
                    ) : f.type === "multiple" ? (
                      <input type="checkbox" checked={f.correctMulti.includes(o.id)} onChange={(e) => set("correctMulti", e.target.checked ? [...f.correctMulti, o.id] : f.correctMulti.filter((x) => x !== o.id))} className="size-4 accent-brand-500" />
                    ) : (
                      <input type="radio" name="correct" checked={f.correctSingle === o.id} onChange={() => set("correctSingle", o.id)} className="size-4 accent-brand-500" />
                    )}
                    <Input value={o.text} onChange={(e) => setOption(o.id, e.target.value)} placeholder={`Opsi ${i + 1}`} />
                    {f.type === "order" && (
                      <div className="flex shrink-0">
                        <IconBtn title="Naik" disabled={i === 0} onClick={() => moveOption(i, -1)}><ArrowUp className="size-4" /></IconBtn>
                        <IconBtn title="Turun" disabled={i === f.options.length - 1} onClick={() => moveOption(i, 1)}><ArrowDown className="size-4" /></IconBtn>
                      </div>
                    )}
                    {f.options.length > 2 && <IconBtn title="Hapus opsi" danger onClick={() => removeOption(o.id)}><X className="size-4" /></IconBtn>}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addOption}><Plus className="size-4" /> Tambah Opsi</Button>
                {f.type === "order" && <p className="text-[11px] text-muted-foreground">Urutan di atas adalah jawaban benar; peserta akan melihatnya teracak.</p>}
              </div>
            </Field>
          )}

          {f.type === "essay" && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">Soal essay dinilai manual — tidak masuk skor otomatis kelulusan.</p>}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Batal</Button>
            <Button onClick={save} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} {question ? "Simpan" : "Tambah"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small quiz badge for the admin lesson row. */
export function QuizBadge({ count }: { count: number }) {
  return (
    <Badge tone={count > 0 ? "cyan" : "neutral"}>
      <ClipboardCheck className="mr-1 size-3" /> {count > 0 ? `${count} soal` : "Assessment"}
    </Badge>
  );
}

function IconBtn({ children, title, onClick, disabled, danger }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} className={cn("grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40", danger ? "hover:text-red-600 dark:hover:text-red-400" : "hover:text-foreground")}>
      {children}
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-brand-500" />
      <span>{label}</span>
    </label>
  );
}
