"use client";

import * as React from "react";
import { CheckCircle2, ChevronDown, ChevronRight, ListChecks, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QueueItem {
  id: string;
  name: string;
  department: string;
  jabatan: string;
  filled?: number; // retained for callers; not shown
  submitted: boolean;
  isHead?: boolean;
}

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";

/** Two collapsible sections — "Antrian" (belum) and "Selesai" (terkunci). */
export function AssessmentQueueList({
  items,
  selectedId,
  onPick,
}: {
  items: QueueItem[];
  selectedId: string;
  onPick: (item: QueueItem) => void;
}) {
  const pending = items.filter((t) => !t.submitted);
  const done = items.filter((t) => t.submitted);
  const [openPending, setOpenPending] = React.useState(true);
  const [openDone, setOpenDone] = React.useState(false);

  return (
    <div className="space-y-2.5">
      <Section
        icon={ListChecks}
        label="Antrian"
        count={pending.length}
        tone="pending"
        open={openPending}
        onToggle={() => setOpenPending((v) => !v)}
      >
        {pending.length === 0 ? (
          <div className="grid place-items-center gap-1 px-3 py-8 text-center">
            <CheckCircle2 className="size-6 text-brand-500" />
            <p className="text-xs font-medium text-foreground">Semua sudah dinilai</p>
            <p className="text-[11px] text-muted-foreground">Tidak ada yang tersisa di antrian.</p>
          </div>
        ) : (
          pending.map((t) => <Row key={t.id} item={t} active={selectedId === t.id} onClick={() => onPick(t)} />)
        )}
      </Section>

      {done.length > 0 && (
        <Section
          icon={CheckCircle2}
          label="Selesai"
          count={done.length}
          tone="done"
          open={openDone}
          onToggle={() => setOpenDone((v) => !v)}
        >
          {done.map((t) => (
            <Row key={t.id} item={t} active={selectedId === t.id} onClick={() => onPick(t)} locked />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  label,
  count,
  tone,
  open,
  onToggle,
  children,
}: {
  icon: typeof ListChecks;
  label: string;
  count: number;
  tone: "pending" | "done";
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const done = tone === "done";
  return (
    <div className={cn("overflow-hidden rounded-2xl border", done ? "border-brand-500/25" : "border-border")}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left transition-colors",
          done ? "bg-brand-500/[0.06] hover:bg-brand-500/10" : "bg-muted/40 hover:bg-muted/60",
        )}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-xl ring-1", done ? "bg-brand-500/12 text-brand-600 ring-brand-500/25 dark:text-brand-400" : "bg-background text-muted-foreground ring-border")}>
            <Icon className="size-4" />
          </span>
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums", done ? "bg-brand-500/15 text-brand-600 dark:text-brand-400" : "bg-foreground/10 text-foreground")}>{count}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && <div className="divide-y divide-border/70 border-t border-border/70">{children}</div>}
    </div>
  );
}

function Row({ item, active, onClick, locked }: { item: QueueItem; active: boolean; onClick: () => void; locked?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 px-3.5 py-3 text-left transition-all",
        active ? "bg-brand-500/[0.07]" : "hover:bg-muted/40 hover:pl-4",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full text-xs font-bold text-white shadow-sm ring-2 ring-background",
          locked ? "bg-gradient-to-br from-emerald-500 to-brand-500" : "bg-gradient-to-br from-sky-500 to-indigo-500",
        )}
      >
        {locked ? <CheckCircle2 className="size-5" /> : initials(item.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
          {item.name}
          {item.isHead && <span className="rounded bg-violet-500/12 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600 dark:text-violet-400">Head</span>}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{[item.department, item.jabatan].filter(Boolean).join(" · ") || "—"}</p>
      </div>
      {locked ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-500/12 px-2 py-1 text-[10px] font-semibold text-brand-600 dark:text-brand-400"><Lock className="size-3" /> Terkunci</span>
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      )}
    </button>
  );
}
