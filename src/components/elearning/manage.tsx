"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronsUpDown,
  Clock,
  FileText,
  FileUp,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  fileKindOf,
  fmtMinutes,
  type ELearningCourse,
  type ELearningDay,
  type ELearningLesson,
} from "@/lib/elearning-shared";
import {
  addLessonFileAction,
  createCourseAction,
  createDayAction,
  createLessonAction,
  deleteDayAction,
  deleteLessonAction,
  deleteLessonFileAction,
  getLessonDetailAction,
  reorderDaysAction,
  reorderLessonsAction,
  updateCourseAction,
  updateDayAction,
  updateLessonAction,
} from "@/lib/actions/elearning";
import { uploadToR2 } from "./upload";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";

export function ManageElearning({ course, days }: { course: ELearningCourse | null; days: ELearningDay[] }) {
  if (!course) return <CreateCourseCard />;
  return (
    <div className="space-y-4">
      <CourseHeader course={course} />
      <DaysManager course={course} days={days.slice().sort((a, b) => a.sortOrder - b.sortOrder)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Course                                                              */
/* ------------------------------------------------------------------ */

function CreateCourseCard() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [title, setTitle] = React.useState("Onboarding Coordinator Area");
  const [category, setCategory] = React.useState("Onboarding");
  const [description, setDescription] = React.useState("");
  const [passScore, setPassScore] = React.useState(70);

  const create = () => {
    if (!title.trim()) return toast.error("Judul course wajib diisi.");
    setBusy(true);
    createCourseAction({ title, description, category, passScore, thumbnailPath: null })
      .then((r) => {
        if (r?.error) return toast.error(r.error);
        toast.success("Course dibuat. Silakan susun Hari & materi.");
        router.refresh();
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-border bg-card p-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Buat Course Pembelajaran</h2>
        <p className="mt-1 text-sm text-muted-foreground">Satu course berisi Learning Path bertahap (Hari 1–7) untuk peserta.</p>
      </div>
      <Field label="Judul Course">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="cth. Onboarding Coordinator Area" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kategori">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="cth. Onboarding" />
        </Field>
        <Field label="Nilai Kelulusan (%)" hint="Untuk assessment (fase berikutnya).">
          <Input type="number" min={0} max={100} value={passScore} onChange={(e) => setPassScore(Number(e.target.value))} />
        </Field>
      </div>
      <Field label="Deskripsi">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ringkasan tujuan pembelajaran…" rows={3} />
      </Field>
      <div className="flex justify-end">
        <Button onClick={create} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Buat Course</Button>
      </div>
    </div>
  );
}

function CourseHeader({ course }: { course: ELearningCourse }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({ title: course.title, category: course.category, description: course.description, passScore: course.passScore, active: course.active });

  const save = () => {
    setBusy(true);
    updateCourseAction(course.id, form)
      .then((r) => {
        if (r?.error) return toast.error(r.error);
        toast.success("Course diperbarui.");
        setEdit(false);
        router.refresh();
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {course.category && <Badge tone="cyan">{course.category}</Badge>}
            <Badge tone={course.active ? "success" : "neutral"}>{course.active ? "Aktif" : "Nonaktif"}</Badge>
            <Badge tone="neutral">Lulus ≥ {course.passScore}%</Badge>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-foreground">{course.title}</h2>
          {course.description && <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{course.description}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil className="size-4" /> Edit Course</Button>
      </div>

      <Dialog open={edit} onOpenChange={setEdit}>
        <DialogContent title="Edit Course" align="center" className="max-w-lg">
          <div className="space-y-3 p-5">
            <Field label="Judul"><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kategori"><Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} /></Field>
              <Field label="Nilai Kelulusan (%)"><Input type="number" min={0} max={100} value={form.passScore} onChange={(e) => setForm((f) => ({ ...f, passScore: Number(e.target.value) }))} /></Field>
            </div>
            <Field label="Deskripsi"><Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
            <Toggle label="Course aktif (terlihat oleh peserta)" checked={form.active} onChange={(v) => setForm((f) => ({ ...f, active: v }))} />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setEdit(false)} disabled={busy}>Batal</Button>
              <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Simpan</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Days                                                                */
/* ------------------------------------------------------------------ */

function DaysManager({ course, days }: { course: ELearningCourse; days: ELearningDay[] }) {
  const router = useRouter();
  const [addOpen, setAddOpen] = React.useState(false);

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= days.length) return;
    const ids = days.map((d) => d.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    reorderDaysAction(ids).then(() => router.refresh());
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Learning Path · {days.length} Hari</p>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="size-4" /> Tambah Hari</Button>
      </div>

      {days.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Belum ada hari. Klik “Tambah Hari” untuk memulai (mis. Hari 1 — Company Profile).
        </div>
      ) : (
        days.map((day, i) => (
          <DayCard key={day.id} course={course} day={day} index={i} count={days.length} onMove={(dir) => move(i, dir)} />
        ))
      )}

      <DayDialog courseId={course.id} open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function DayCard({ course, day, index, count, onMove }: { course: ELearningCourse; day: ELearningDay; index: number; count: number; onMove: (dir: -1 | 1) => void }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(true);
  const [edit, setEdit] = React.useState(false);
  const [addLesson, setAddLesson] = React.useState(false);
  const lessons = day.lessons.slice().sort((a, b) => a.sortOrder - b.sortOrder);

  const remove = () => {
    if (!window.confirm(`Hapus "${day.title}" beserta seluruh materinya?`)) return;
    deleteDayAction(day.id).then((r) => {
      if (r?.error) return toast.error(r.error);
      toast.success("Hari dihapus.");
      router.refresh();
    });
  };

  const moveLesson = (li: number, dir: -1 | 1) => {
    const next = li + dir;
    if (next < 0 || next >= lessons.length) return;
    const ids = lessons.map((l) => l.id);
    [ids[li], ids[next]] = [ids[next], ids[li]];
    reorderLessonsAction(ids).then(() => router.refresh());
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 p-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-sm font-semibold text-brand-700 dark:text-brand-400">{index + 1}</span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{day.title}</p>
            <p className="truncate text-xs text-muted-foreground">{lessons.length} materi{day.description ? ` · ${day.description}` : ""}</p>
          </div>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn title="Naik" disabled={index === 0} onClick={() => onMove(-1)}><ChevronsUpDown className="size-4 rotate-180" /></IconBtn>
          <IconBtn title="Turun" disabled={index === count - 1} onClick={() => onMove(1)}><ChevronsUpDown className="size-4" /></IconBtn>
          <IconBtn title="Edit hari" onClick={() => setEdit(true)}><Pencil className="size-4" /></IconBtn>
          <IconBtn title="Hapus hari" danger onClick={remove}><Trash2 className="size-4" /></IconBtn>
        </div>
      </div>

      {open && (
        <div className="space-y-1.5 border-t border-border p-2.5">
          {lessons.map((l, li) => (
            <LessonRow key={l.id} course={course} lesson={l} index={li} count={lessons.length} onMove={(dir) => moveLesson(li, dir)} />
          ))}
          <Button variant="outline" size="sm" className="w-full" onClick={() => setAddLesson(true)}><Plus className="size-4" /> Tambah Materi</Button>
        </div>
      )}

      <DayDialog courseId={course.id} day={day} open={edit} onOpenChange={setEdit} />
      <LessonDialog course={course} dayId={day.id} open={addLesson} onOpenChange={setAddLesson} />
    </div>
  );
}

function DayDialog({ courseId, day, open, onOpenChange }: { courseId: string; day?: ELearningDay; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [title, setTitle] = React.useState(day?.title ?? "");
  const [description, setDescription] = React.useState(day?.description ?? "");

  React.useEffect(() => {
    if (open) {
      setTitle(day?.title ?? "");
      setDescription(day?.description ?? "");
    }
  }, [open, day]);

  const save = () => {
    if (!title.trim()) return toast.error("Judul hari wajib diisi.");
    setBusy(true);
    const p = day ? updateDayAction(day.id, { title, description }) : createDayAction({ courseId, title, description });
    p.then((r) => {
      if (r?.error) return toast.error(r.error);
      toast.success(day ? "Hari diperbarui." : "Hari ditambahkan.");
      onOpenChange(false);
      router.refresh();
    }).finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={day ? "Edit Hari" : "Tambah Hari"} align="center" className="max-w-md">
        <div className="space-y-3 p-5">
          <Field label="Judul Hari" hint="cth. Hari 1 — Company Profile">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Hari 1 — Company Profile" />
          </Field>
          <Field label="Deskripsi (opsional)">
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ringkasan materi hari ini…" />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Batal</Button>
            <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />} {day ? "Simpan" : "Tambah"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Lessons                                                             */
/* ------------------------------------------------------------------ */

function LessonRow({ course, lesson, index, count, onMove }: { course: ELearningCourse; lesson: ELearningLesson; index: number; count: number; onMove: (dir: -1 | 1) => void }) {
  const router = useRouter();
  const [edit, setEdit] = React.useState(false);

  const remove = () => {
    if (!window.confirm(`Hapus materi "${lesson.title}"?`)) return;
    deleteLessonAction(lesson.id).then((r) => {
      if (r?.error) return toast.error(r.error);
      toast.success("Materi dihapus.");
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-2.5">
      <GripVertical className="size-4 shrink-0 text-muted-foreground/50" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{lesson.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          {lesson.required && <span className="font-medium text-amber-600 dark:text-amber-400">Wajib</span>}
          {lesson.hasVideo && <span className="inline-flex items-center gap-0.5">· <Video className="size-3" /> Video</span>}
          {lesson.mustCompleteVideo && <span>· wajib tonton</span>}
          {lesson.allowSkip && <span>· boleh skip</span>}
          {lesson.estimatedMinutes > 0 && <span className="inline-flex items-center gap-0.5">· <Clock className="size-3" /> {fmtMinutes(lesson.estimatedMinutes)}</span>}
          {lesson.fileCount > 0 && <span>· {lesson.fileCount} lampiran</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <IconBtn title="Naik" disabled={index === 0} onClick={() => onMove(-1)}><ChevronsUpDown className="size-4 rotate-180" /></IconBtn>
        <IconBtn title="Turun" disabled={index === count - 1} onClick={() => onMove(1)}><ChevronsUpDown className="size-4" /></IconBtn>
        <IconBtn title="Edit materi" onClick={() => setEdit(true)}><Pencil className="size-4" /></IconBtn>
        <IconBtn title="Hapus materi" danger onClick={remove}><Trash2 className="size-4" /></IconBtn>
      </div>
      <LessonDialog course={course} dayId={lesson.dayId} lesson={lesson} open={edit} onOpenChange={setEdit} />
    </div>
  );
}

interface LessonFormState {
  title: string;
  description: string;
  estimatedMinutes: number;
  required: boolean;
  allowSkip: boolean;
  mustCompleteVideo: boolean;
  tags: string;
  thumbnailPath: string | null;
  videoPath: string | null;
}

function LessonDialog({ course, dayId, lesson, open, onOpenChange }: { course: ELearningCourse; dayId: string; lesson?: ELearningLesson; open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [detail, setDetail] = React.useState<ELearningLesson | null>(null);
  const [videoName, setVideoName] = React.useState<string | null>(null);
  const [videoPct, setVideoPct] = React.useState<number | null>(null);
  const [thumbPct, setThumbPct] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<LessonFormState>(blank());

  function blank(): LessonFormState {
    return { title: "", description: "", estimatedMinutes: 10, required: true, allowSkip: false, mustCompleteVideo: false, tags: "", thumbnailPath: null, videoPath: null };
  }

  // Populate on open (fetch detail for the file list when editing).
  React.useEffect(() => {
    if (!open) return;
    if (lesson) {
      setForm({
        title: lesson.title,
        description: lesson.description,
        estimatedMinutes: lesson.estimatedMinutes,
        required: lesson.required,
        allowSkip: lesson.allowSkip,
        mustCompleteVideo: lesson.mustCompleteVideo,
        tags: lesson.tags.join(", "),
        thumbnailPath: undefined as unknown as string | null, // keep existing unless replaced
        videoPath: undefined as unknown as string | null,
      });
      setVideoName(lesson.hasVideo ? "Video tersimpan" : null);
      getLessonDetailAction(lesson.id).then((r) => r.ok && setDetail(r.lesson));
    } else {
      setForm(blank());
      setVideoName(null);
      setDetail(null);
    }
    setVideoPct(null);
    setThumbPct(null);
  }, [open, lesson]);

  const set = <K extends keyof LessonFormState>(k: K, v: LessonFormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onVideo = async (file: File) => {
    if (!file.type.startsWith("video/")) return toast.error("File harus berupa video.");
    setVideoName(file.name);
    setVideoPct(0);
    try {
      const path = await uploadToR2(file, "video", setVideoPct);
      set("videoPath", path);
      setVideoPct(100);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload video gagal.");
      setVideoPct(null);
    }
  };

  const onThumb = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Thumbnail harus gambar.");
    setThumbPct(0);
    try {
      const path = await uploadToR2(file, "thumbnail", setThumbPct);
      set("thumbnailPath", path);
      setThumbPct(100);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload thumbnail gagal.");
      setThumbPct(null);
    }
  };

  const save = () => {
    if (!form.title.trim()) return toast.error("Judul materi wajib diisi.");
    if (videoPct !== null && videoPct < 100) return toast.error("Tunggu upload video selesai.");
    setBusy(true);
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const base = {
      title: form.title,
      description: form.description,
      estimatedMinutes: form.estimatedMinutes,
      required: form.required,
      allowSkip: form.allowSkip,
      mustCompleteVideo: form.mustCompleteVideo,
      tags,
    };
    const p = lesson
      ? updateLessonAction(lesson.id, {
          ...base,
          ...(form.thumbnailPath !== undefined && form.thumbnailPath !== null ? { thumbnailPath: form.thumbnailPath } : {}),
          ...(form.videoPath !== undefined && form.videoPath !== null ? { videoPath: form.videoPath } : {}),
        })
      : createLessonAction({ ...base, courseId: course.id, dayId, thumbnailPath: form.thumbnailPath ?? null, videoPath: form.videoPath ?? null });
    p.then((r) => {
      if (r?.error) return toast.error(r.error);
      toast.success(lesson ? "Materi diperbarui." : "Materi ditambahkan.");
      onOpenChange(false);
      router.refresh();
    }).finally(() => setBusy(false));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={lesson ? "Edit Materi" : "Tambah Materi"} align="center" className="max-w-xl">
        <div className="max-h-[76vh] space-y-3 overflow-y-auto p-5">
          <Field label="Judul Materi"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="cth. Company Profile" /></Field>
          <Field label="Deskripsi"><Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Penjelasan materi…" /></Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Estimasi Belajar (menit)"><Input type="number" min={0} value={form.estimatedMinutes} onChange={(e) => set("estimatedMinutes", Number(e.target.value))} /></Field>
            <Field label="Tag (pisahkan koma)"><Input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="onboarding, sop" /></Field>
          </div>

          {/* Video */}
          <Field label="Video (opsional)" hint="Hanya Head Operational yang dapat mengunggah. Maks 2 GB.">
            <FilePick file={videoName} accept="video/*" onPick={onVideo} icon={<Video className="size-4" />} label={videoName ? "Ganti video" : "Unggah video"} />
            {videoPct !== null && <UploadBar pct={videoPct} />}
          </Field>

          {/* Thumbnail */}
          <Field label="Thumbnail (opsional)" hint="Gambar sampul materi.">
            <FilePick file={form.thumbnailPath ? "Thumbnail terpasang" : lesson?.thumbnailUrl ? "Thumbnail tersimpan" : null} accept="image/*" onPick={onThumb} icon={<FileUp className="size-4" />} label="Unggah thumbnail" />
            {thumbPct !== null && <UploadBar pct={thumbPct} />}
          </Field>

          {/* Rules */}
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Toggle label="Materi wajib" checked={form.required} onChange={(v) => set("required", v)} />
            <Toggle label="Wajib tonton video sampai selesai" checked={form.mustCompleteVideo} onChange={(v) => set("mustCompleteVideo", v)} />
            <Toggle label="Boleh dilewati (skip)" checked={form.allowSkip} onChange={(v) => set("allowSkip", v)} />
          </div>

          {/* Attachments (edit mode only) */}
          {lesson ? (
            <Attachments course={course} dayId={dayId} lesson={lesson} files={detail?.files ?? []} onChanged={() => getLessonDetailAction(lesson.id).then((r) => r.ok && setDetail(r.lesson))} />
          ) : (
            <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Simpan materi dulu untuk menambahkan lampiran PDF/SOP/dokumen.</p>
          )}

          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Batal</Button>
            <Button onClick={save} disabled={busy || videoPct === 0}>{busy && <Loader2 className="animate-spin" />} {lesson ? "Simpan" : "Tambah Materi"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Attachments({ course, dayId, lesson, files, onChanged }: { course: ELearningCourse; dayId: string; lesson: ELearningLesson; files: NonNullable<ELearningLesson["files"]>; onChanged: () => void }) {
  const router = useRouter();
  const [pct, setPct] = React.useState<number | null>(null);

  const add = async (file: File) => {
    setPct(0);
    try {
      const path = await uploadToR2(file, "file", setPct);
      const res = await addLessonFileAction({ courseId: course.id, dayId, lessonId: lesson.id, kind: fileKindOf(file.type, file.name), name: file.name, path, size: file.size, downloadable: true });
      if ("error" in res && res.error) throw new Error(res.error);
      toast.success("Lampiran ditambahkan.");
      onChanged();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload lampiran gagal.");
    } finally {
      setPct(null);
    }
  };

  const del = (id: string) => {
    deleteLessonFileAction(id).then((r) => {
      if (r?.error) return toast.error(r.error);
      onChanged();
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lampiran (PDF / SOP / Dokumen / Gambar)</p>
      {files.map((f) => (
        <div key={f.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/40 p-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{f.name}</span>
          <Badge tone="neutral">{f.kind.toUpperCase()}</Badge>
          <IconBtn title="Hapus lampiran" danger onClick={() => del(f.id)}><X className="size-4" /></IconBtn>
        </div>
      ))}
      <FilePick file={null} accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" onPick={add} icon={<FileUp className="size-4" />} label="Tambah lampiran" />
      {pct !== null && <UploadBar pct={pct} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small shared bits                                                   */
/* ------------------------------------------------------------------ */

function IconBtn({ children, title, onClick, disabled, danger }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-40",
        danger ? "hover:text-red-600 dark:hover:text-red-400" : "hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-foreground">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-brand-500" />
    </label>
  );
}

function FilePick({ file, accept, onPick, icon, label }: { file: string | null; accept: string; onPick: (f: File) => void; icon: React.ReactNode; label: string }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
      <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 self-start rounded-lg border border-input bg-background/40 px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50">
        {icon}
        {label}
        <input type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.currentTarget.value = ""; }} />
      </label>
      {file && <span className="min-w-0 truncate text-xs text-muted-foreground">{file}</span>}
    </div>
  );
}

function UploadBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2 space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-muted-foreground">{pct < 100 ? `Mengunggah… ${pct}%` : "Selesai diunggah"}</p>
    </div>
  );
}
