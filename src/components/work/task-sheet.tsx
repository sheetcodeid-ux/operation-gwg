"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PRIORITY_META, TASK_STATUS_META, WORK_CATEGORIES, WORK_BRANDS } from "@/lib/constants";
import type { Priority, TaskStatus } from "@/lib/types";
import { addTaskCategoryAction, createTaskAction, deleteTaskCategoryAction, updateTaskAction } from "@/lib/actions/work";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, useSheetControl } from "@/components/ui/sheet";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { MultiCombobox, SelectionChips } from "@/components/ui/multi-combobox";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { divisionLabel } from "./division-filter";

export interface TaskOutlet {
  id: string;
  name: string;
  coordinatorId: string | null;
}

export interface EditableTask {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TaskStatus;
  division: string;
  outletId: string | null;
  outletIds?: string[];
  brands?: string[];
  picIds: string[];
  start: string;
  due: string;
  progress: number;
}

const PRIORITIES = Object.keys(PRIORITY_META) as Priority[];
const STATUSES = Object.keys(TASK_STATUS_META) as TaskStatus[];

/** Default date for a NEW task's Start/Due fields — the REAL current date (local
 *  time), so a new task always lands in the running month and automatically
 *  rolls into the next month/year as time passes (no more being stuck in a past
 *  month). Local Y-M-D avoids a UTC off-by-one at the edges of the day. */
function defaultDateISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateInput(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(+d) ? defaultDateISO() : d.toISOString().slice(0, 10);
}

/** Slide-in (Sheet) task form — create or edit, by division, with optional branch. Shared by Dashboard + Work Tracker. */
export type DivisionMembers = Record<string, { id: string; name: string; jabatan?: string | null }[]>;

export function TaskSheet({
  trigger,
  task,
  outlets,
  members,
  divisions,
  defaultDivision,
  isAdmin,
  userDepartment,
  categories,
}: {
  trigger: React.ReactElement;
  task?: EditableTask;
  outlets: TaskOutlet[];
  members?: DivisionMembers;
  divisions?: string[];
  defaultDivision?: string;
  /** Super Admin can target any department + manage categories. */
  isAdmin?: boolean;
  /** The creator's own department — the fixed division for non-admins. */
  userDepartment?: string;
  /** Category options per department (custom list or defaults). */
  categories?: Record<string, string[]>;
  /** Accepted for back-compat; no longer used (assignment is by division). */
  coordinators?: { id: string; name: string }[];
}) {
  return (
    <Sheet>
      <SheetTrigger>{trigger}</SheetTrigger>
      <SheetContent
        title={task ? "Edit Task" : "New Work Task"}
        description={task ? "Update this task." : "Buat tugas untuk departemen Anda — dengan atau tanpa cabang."}
        className="max-w-lg"
      >
        <TaskForm task={task} outlets={outlets} members={members} divisions={divisions} defaultDivision={defaultDivision} isAdmin={isAdmin} userDepartment={userDepartment} categories={categories} />
      </SheetContent>
    </Sheet>
  );
}

/** Category dropdown; Super Admin can add/remove THIS department's categories
 *  inline. Edits are OPTIMISTIC (instant) — the list updates immediately and the
 *  server call persists in the background (only that department is affected). */
function CategoryPicker({
  value,
  onChange,
  options,
  department,
  isAdmin,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  department: string;
  isAdmin: boolean;
}) {
  const [list, setList] = React.useState<string[]>(options);
  // Re-sync when the department (and thus its options) changes.
  React.useEffect(() => setList(options), [options]);
  const [manage, setManage] = React.useState(false);
  const [newCat, setNewCat] = React.useState("");

  const add = () => {
    const name = newCat.trim();
    setNewCat("");
    if (!name || list.includes(name)) return;
    setList((l) => [...l, name].sort((a, b) => a.localeCompare(b))); // instant
    onChange(name);
    addTaskCategoryAction(department, name).then((res) => {
      if (res?.error) {
        toast.error(res.error);
        setList((l) => l.filter((c) => c !== name)); // rollback
      }
    });
  };
  const del = (name: string) => {
    setList((l) => l.filter((c) => c !== name)); // instant
    if (value === name) onChange(list.find((c) => c !== name) ?? "");
    deleteTaskCategoryAction(department, name).then((res) => {
      if (res?.error) {
        toast.error(res.error);
        setList((l) => [...l, name].sort((a, b) => a.localeCompare(b))); // rollback
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <Combobox value={value} onChange={onChange} options={list.map((c) => ({ value: c, label: c }))} searchPlaceholder="Cari kategori…" />
      {isAdmin && (
        <>
          <button type="button" onClick={() => setManage((m) => !m)} className="text-[11px] font-medium text-primary hover:underline">
            {manage ? "Tutup kelola kategori" : "Kelola kategori (admin)"}
          </button>
          {manage && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-2">
              <div className="flex gap-1.5">
                <Input
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  placeholder="Kategori baru…"
                  className="h-8"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      add();
                    }
                  }}
                />
                <Button size="sm" type="button" onClick={add} disabled={!newCat.trim()}>
                  <Plus className="size-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] text-foreground/80">
                    {c}
                    <button type="button" onClick={() => del(c)} className="text-muted-foreground hover:text-red-500" title="Hapus kategori">
                      <Trash2 className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Kategori khusus departemen {divisionLabel(department)} — tersimpan permanen untuk semua anggota departemen ini.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TaskForm({
  task,
  outlets,
  members,
  divisions = [],
  defaultDivision,
  isAdmin = false,
  userDepartment,
  categories,
}: {
  task?: EditableTask;
  outlets: TaskOutlet[];
  members?: DivisionMembers;
  divisions?: string[];
  defaultDivision?: string;
  isAdmin?: boolean;
  userDepartment?: string;
  categories?: Record<string, string[]>;
}) {
  const router = useRouter();
  const { setOpen } = useSheetControl();
  const [pending, startTransition] = React.useTransition();
  // Cakupan tugas: tanpa cabang, per cabang, atau per brand.
  type Scope = "none" | "branch" | "brand";
  const [scope, setScope] = React.useState<Scope>(
    task?.brands?.length ? "brand" : task?.outletIds?.length || task?.outletId ? "branch" : "none",
  );
  // SATU tugas menyentuh banyak cabang. Versi lama membuat satu tugas per
  // cabang, sehingga satu pekerjaan yang berdampak ke ~50 cabang muncul 50 kali
  // di Work Tracker padahal kerjaannya cuma satu.
  const [outletIds, setOutletIds] = React.useState<string[]>(task?.outletIds ?? (task?.outletId ? [task.outletId] : []));
  const [brands, setBrands] = React.useState<string[]>(task?.brands ?? []);
  const [allOutlets, setAllOutlets] = React.useState(false);
  const effectiveOutletIds = scope === "branch" ? (allOutlets ? outlets.map((o) => o.id) : outletIds) : [];
  const initialDivision = task?.division ?? userDepartment ?? defaultDivision ?? divisions[0] ?? "";
  const catsFor = React.useCallback(
    (div: string) => categories?.[div] ?? (WORK_CATEGORIES as readonly string[] as string[]),
    [categories],
  );
  const [form, setForm] = React.useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    category: task?.category ?? catsFor(initialDivision)[0] ?? "",
    priority: task?.priority ?? ("medium" as Priority),
    status: task?.status ?? ("open" as TaskStatus),
    division: initialDivision,
    outletId: task?.outletId ?? outlets[0]?.id ?? "",
    picIds: task?.picIds ?? [],
    startDate: task ? toDateInput(task.start) : defaultDateISO(),
    dueDate: task ? toDateInput(task.due) : defaultDateISO(7),
    progress: task?.progress ?? 0,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function pickDivision(v: string) {
    // Members AND categories differ per division — keep any still-valid PICs,
    // and switch to the new division's category if the current one isn't there.
    const validIds = new Set((members?.[v] ?? []).map((m) => m.id));
    const cats = catsFor(v);
    setForm((f) => ({
      ...f,
      division: v,
      picIds: f.picIds.filter((id) => validIds.has(id)),
      category: cats.includes(f.category) ? f.category : cats[0] ?? "",
    }));
  }

  const duration = Math.round((+new Date(form.dueDate) - +new Date(form.startDate)) / 86_400_000);
  const validRange = duration >= 0;
  const divMembers = members?.[form.division] ?? [];
  const picNames = form.picIds.map((id) => divMembers.find((m) => m.id === id)?.name).filter((n): n is string => !!n);

  function submit() {
    if (!form.title.trim()) {
      toast.error("Task title is required.");
      return;
    }
    if (scope === "branch" && effectiveOutletIds.length === 0) {
      toast.error("Pilih minimal satu outlet, centang Semua Outlet, atau ganti ke Tanpa Cabang.");
      return;
    }
    if (scope === "brand" && brands.length === 0) {
      toast.error("Pilih minimal satu brand, atau ganti ke Tanpa Cabang.");
      return;
    }
    if (!validRange) {
      toast.error("Due date must be on or after the start date.");
      return;
    }
    const payload = {
      title: form.title,
      description: form.description,
      category: form.category,
      priority: form.priority,
      status: form.status,
      division: form.division,
      picIds: form.picIds,
      startDate: new Date(form.startDate).toISOString(),
      dueDate: new Date(form.dueDate).toISOString(),
      progress: form.progress,
      // Cabang pertama dipakai sebagai cabang utama (area, tampilan ringkas).
      outletId: effectiveOutletIds[0] ?? null,
      outletIds: effectiveOutletIds,
      brands: scope === "brand" ? brands : [],
    };
    startTransition(async () => {
      const res = task ? await updateTaskAction(task.id, payload) : await createTaskAction(payload);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      const cakupan =
        scope === "branch" && effectiveOutletIds.length > 1
          ? ` — ${effectiveOutletIds.length} cabang`
          : scope === "brand" && brands.length > 0
            ? ` — ${brands.join(", ")}`
            : "";
      toast.success((task ? "Task diperbarui" : "Task dibuat") + cakupan);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <Field label="Task Title">
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. AC service & cleaning" />
        </Field>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Details…" />
        </Field>

        {isAdmin ? (
          <Field label="Departemen">
            <Combobox
              value={form.division}
              onChange={pickDivision}
              options={divisions.map((d) => ({ value: d, label: divisionLabel(d) }))}
              searchPlaceholder="Cari departemen…"
            />
          </Field>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2">
            <span className="text-xs text-muted-foreground">Departemen</span>
            <span className="text-sm font-medium text-foreground">{divisionLabel(form.division)}</span>
          </div>
        )}

        <Field label={`PIC · siapa yang mengerjakan (${form.picIds.length})`}>
          {divMembers.length ? (
            <div className="space-y-2">
              <MultiCombobox
                value={form.picIds}
                onChange={(v) => set("picIds", v)}
                options={divMembers.map((m) => ({ value: m.id, label: m.name }))}
                placeholder="Pilih PIC (boleh lebih dari satu)…"
                searchPlaceholder="Cari nama…"
              />
              <SelectionChips labels={picNames} onClear={() => set("picIds", [])} />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
              Belum ada anggota di divisi ini.
            </p>
          )}
        </Field>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Cakupan</p>
          <SegmentedTabs
            value={scope}
            onChange={(v) => setScope(v as Scope)}
            items={[
              { value: "none", label: "Tanpa Cabang" },
              { value: "branch", label: "Dengan Cabang" },
              { value: "brand", label: "Dengan Brand" },
            ]}
          />
        </div>

        {scope === "branch" && (
          <Field
            label={`Outlet (${effectiveOutletIds.length})`}
            hint="Satu task untuk semua cabang yang dipilih — bukan satu task per cabang."
          >
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm text-foreground">
                <input type="checkbox" checked={allOutlets} onChange={(e) => setAllOutlets(e.target.checked)} className="size-4 accent-brand-500" />
                Semua Outlet ({outlets.length})
              </label>
              {!allOutlets && (
                <>
                  <MultiCombobox
                    value={outletIds}
                    onChange={setOutletIds}
                    options={outlets.map((o) => ({ value: o.id, label: o.name }))}
                    placeholder="Pilih beberapa outlet…"
                    searchPlaceholder="Cari outlet…"
                  />
                  <SelectionChips
                    labels={outletIds.map((id) => outlets.find((o) => o.id === id)?.name).filter((n): n is string => !!n)}
                    onClear={() => setOutletIds([])}
                  />
                </>
              )}
            </div>
          </Field>
        )}

        {scope === "brand" && (
          <Field label={`Brand (${brands.length})`} hint="Untuk kerjaan yang menyentuh seluruh brand, bukan cabang tertentu.">
            <div className="space-y-2">
              <MultiCombobox
                value={brands}
                onChange={setBrands}
                options={WORK_BRANDS.map((b) => ({ value: b, label: b }))}
                placeholder="Pilih brand…"
              />
              <SelectionChips labels={brands} onClear={() => setBrands([])} />
            </div>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategori">
            <CategoryPicker
              value={form.category}
              onChange={(v) => set("category", v)}
              options={catsFor(form.division)}
              department={form.division}
              isAdmin={isAdmin}
            />
          </Field>
          <Field label="Priority">
            <Combobox value={form.priority} onChange={(v) => set("priority", v as Priority)} options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))} />
          </Field>
        </div>

        <Field label="Status">
          <Combobox value={form.status} onChange={(v) => set("status", v as TaskStatus)} options={STATUSES.map((s) => ({ value: s, label: TASK_STATUS_META[s].label }))} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal Mulai">
            <DatePicker value={form.startDate} onChange={(v) => set("startDate", v)} />
          </Field>
          <Field label="Tanggal Selesai">
            <DatePicker value={form.dueDate} onChange={(v) => set("dueDate", v)} />
          </Field>
        </div>

        <div
          className={cn(
            "flex items-center justify-between rounded-xl border px-4 py-3",
            validRange ? "border-border bg-muted/30" : "border-red-500/40 bg-red-500/10",
          )}
        >
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="size-4" />
            Durasi pengerjaan
          </span>
          <span className={cn("text-sm font-semibold", validRange ? "text-foreground" : "text-red-500")}>
            {validRange ? `${duration} hari` : "Tanggal tidak valid"}
          </span>
        </div>

        <Field label={`Progress · ${form.progress}%`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={form.progress}
            onChange={(e) => set("progress", Number(e.target.value))}
            className="w-full accent-foreground"
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 border-t border-border p-4">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} {task ? "Save Changes" : "Create Task"}
        </Button>
      </div>
    </>
  );
}
