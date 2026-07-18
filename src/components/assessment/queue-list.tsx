"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronRight, ListChecks, Lock } from "lucide-react";
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

/** Antrian / Selesai — collapsible, with a completion progress bar. Aniq-ui
 *  styling: glass sections, squircle monochrome avatars, brand accent only. */
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
  const pct = items.length ? Math.round((done.length / items.length) * 100) : 0;

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <div className="glass rounded-2xl border border-border p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Progres penilaian</span>
            <span className="text-muted-foreground">
              <b className="tabular-nums text-foreground">{done.length}</b> / {items.length} selesai
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <Section icon={ListChecks} label="Antrian" count={pending.length} tone="pending" open={openPending} onToggle={() => setOpenPending((v) => !v)}>
        {pending.length === 0 ? (
          <div className="grid place-items-center gap-1.5 px-3 py-9 text-center">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-500/10 text-brand-600 ring-1 ring-brand-500/20 dark:text-brand-400"><Check className="size-5" /></span>
            <p className="text-xs font-medium text-foreground">Semua sudah dinilai</p>
            <p className="text-[11px] text-muted-foreground">Tidak ada yang tersisa di antrian.</p>
          </div>
        ) : (
          pending.map((t) => <Row key={t.id} item={t} active={selectedId === t.id} onClick={() => onPick(t)} />)
        )}
      </Section>

      {done.length > 0 && (
        <Section icon={Check} label="Selesai" count={done.length} tone="done" open={openDone} onToggle={() => setOpenDone((v) => !v)}>
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
    <div className="glass overflow-hidden rounded-2xl border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1", done ? "bg-brand-500/10 text-brand-600 ring-brand-500/20 dark:text-brand-400" : "bg-muted text-muted-foreground ring-border")}>
            <Icon className="size-4" strokeWidth={2} />
          </span>
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="min-w-5 rounded-full bg-foreground/[0.07] px-1.5 py-0.5 text-center text-[11px] font-bold tabular-nums text-foreground">{count}</span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && <div className="divide-y divide-border/60 border-t border-border/60">{children}</div>}
    </div>
  );
}

function Row({ item, active, onClick, locked }: { item: QueueItem; active: boolean; onClick: () => void; locked?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 px-4 py-3 text-left transition-all",
        active ? "bg-brand-500/[0.06]" : "hover:bg-muted/30",
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl text-[11px] font-bold ring-1 transition-colors",
          locked ? "bg-brand-500/10 text-brand-600 ring-brand-500/20 dark:text-brand-400" : "bg-muted text-foreground ring-border group-hover:ring-foreground/20",
        )}
      >
        {locked ? <Check className="size-5" strokeWidth={2.5} /> : initials(item.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
          {item.name}
          {item.isHead && <span className="rounded bg-foreground/[0.07] px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">Head</span>}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">{[item.department, item.jabatan].filter(Boolean).join(" · ") || "—"}</p>
      </div>
      {locked ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground"><Lock className="size-3" /> Terkunci</span>
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      )}
    </button>
  );
}
