"use client";

import * as React from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, Clock, ListChecks, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QueueItem {
  id: string;
  name: string;
  department: string;
  jabatan: string;
  filled: number; // 0..6
  submitted: boolean;
  isHead?: boolean;
}

/** Two collapsible sections — "Antrian" (belum selesai) and "Selesai" (terkunci).
 *  Selesai items open read-only. Keeps the evaluator/peer view tidy. */
export function AssessmentQueueList({
  items,
  selectedId,
  onPick,
  verb = "dinilai",
}: {
  items: QueueItem[];
  selectedId: string;
  onPick: (item: QueueItem) => void;
  verb?: string;
}) {
  const pending = items.filter((t) => !t.submitted);
  const done = items.filter((t) => t.submitted);
  const [openPending, setOpenPending] = React.useState(true);
  const [openDone, setOpenDone] = React.useState(false);

  return (
    <div className="space-y-2">
      <Section
        icon={ListChecks}
        label={`Antrian — pilih siapa yang ${verb}`}
        count={pending.length}
        tone="pending"
        open={openPending}
        onToggle={() => setOpenPending((v) => !v)}
        empty="Semua sudah dinilai — tidak ada antrian tersisa. 🎉"
      >
        {pending.map((t) => (
          <Row key={t.id} item={t} active={selectedId === t.id} onClick={() => onPick(t)} />
        ))}
      </Section>

      {done.length > 0 && (
        <Section
          icon={CheckCircle2}
          label="Selesai (terkunci)"
          count={done.length}
          tone="done"
          open={openDone}
          onToggle={() => setOpenDone((v) => !v)}
          empty=""
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
  empty,
  children,
}: {
  icon: typeof ListChecks;
  label: string;
  count: number;
  tone: "pending" | "done";
  open: boolean;
  onToggle: () => void;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon className={cn("size-4 shrink-0", tone === "done" ? "text-brand-500" : "text-muted-foreground")} />
          <span className="truncate text-sm font-semibold text-foreground">{label}</span>
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              tone === "done" ? "bg-brand-500/12 text-brand-600 dark:text-brand-400" : "bg-muted text-muted-foreground",
            )}
          >
            {count}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="divide-y divide-border">
          {count === 0 ? <p className="px-3 py-4 text-center text-[11px] text-muted-foreground">{empty}</p> : children}
        </div>
      )}
    </div>
  );
}

function Row({ item, active, onClick, locked }: { item: QueueItem; active: boolean; onClick: () => void; locked?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 p-3 text-left transition-colors",
        active ? "bg-brand-500/5" : "hover:bg-muted/40",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full ring-1",
          locked
            ? "bg-brand-500/12 text-brand-600 ring-brand-500/25 dark:text-brand-400"
            : item.filled > 0
              ? "bg-amber-500/12 text-amber-600 ring-amber-500/25 dark:text-amber-400"
              : "bg-muted text-muted-foreground ring-border",
        )}
      >
        {locked ? <CheckCircle2 className="size-4" /> : item.filled > 0 ? <Clock className="size-4" /> : <Circle className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
          {item.name}
          {item.isHead && <span className="rounded bg-violet-500/12 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600 dark:text-violet-400">Head</span>}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{[item.department, item.jabatan].filter(Boolean).join(" · ") || "—"}</p>
      </div>
      {locked ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-brand-600 dark:text-brand-400"><Lock className="size-3" /> Terkunci</span>
      ) : (
        <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{item.filled > 0 ? `Draft ${item.filled}/6` : "Belum"}</span>
      )}
      {!locked && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
    </button>
  );
}
