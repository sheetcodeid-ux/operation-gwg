"use client";

import * as React from "react";
import { CalendarRange, ConciergeBell, ListChecks, MessageSquareWarning, Search, SprayCan, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/page-header";
import { cn, fromNow } from "@/lib/utils";

export type AuditType = "hospitality" | "hygiene" | "task" | "complaint" | "event";

export interface AuditItem {
  at: string;
  type: AuditType;
  text: string;
  outlet: string;
}

const META: Record<AuditType, { label: string; icon: LucideIcon; color: string; dot: string }> = {
  hospitality: { label: "Hospitality", icon: ConciergeBell, color: "bg-violet-500/10 text-violet-600 ring-violet-500/25 dark:text-violet-400", dot: "bg-violet-500" },
  hygiene: { label: "Hygiene", icon: SprayCan, color: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-400", dot: "bg-emerald-500" },
  task: { label: "Tasks", icon: ListChecks, color: "bg-blue-500/10 text-blue-600 ring-blue-500/25 dark:text-blue-400", dot: "bg-blue-500" },
  complaint: { label: "Complaints", icon: MessageSquareWarning, color: "bg-amber-500/10 text-amber-600 ring-amber-500/25 dark:text-amber-400", dot: "bg-amber-500" },
  event: { label: "Events", icon: CalendarRange, color: "bg-rose-500/10 text-rose-600 ring-rose-500/25 dark:text-rose-400", dot: "bg-rose-500" },
};
const TYPES = Object.keys(META) as AuditType[];

/** Human day label for a group header. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Hari ini";
  if (same(d, yest)) return "Kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function AuditFeed({ items }: { items: AuditItem[] }) {
  const [type, setType] = React.useState<AuditType | "all">("all");
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(
      (i) => (type === "all" || i.type === type) && (!needle || i.text.toLowerCase().includes(needle) || i.outlet.toLowerCase().includes(needle)),
    );
  }, [items, type, q]);

  // Group by calendar day, preserving the incoming (newest-first) order.
  const groups = React.useMemo(() => {
    const out: { key: string; label: string; items: AuditItem[] }[] = [];
    for (const it of filtered) {
      const key = new Date(it.at).toDateString();
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(it);
      else out.push({ key, label: dayLabel(it.at), items: [it] });
    }
    return out;
  }, [filtered]);

  return (
    <div className="glass rounded-2xl border border-border">
      {/* Controls */}
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Activity Feed</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">{filtered.length} aktivitas</span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari aktivitas atau outlet…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={type === "all"} onClick={() => setType("all")}>
            Semua
          </Chip>
          {TYPES.map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(t)} dot={META[t].dot}>
              {META[t].label}
            </Chip>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="no-scrollbar max-h-[36rem] overflow-y-auto p-4">
        {groups.length === 0 ? (
          <EmptyState icon={Search} title="Tidak ada aktivitas" description={q || type !== "all" ? "Coba ubah kata kunci atau filter." : "Belum ada aktivitas tercatat."} />
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="mb-2 pl-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
                <div className="space-y-1">
                  {g.items.map((a, i) => {
                    const m = META[a.type];
                    const Icon = m.icon;
                    return (
                      <div key={i} className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/40">
                        <div className={cn("mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ring-1", m.color)}>
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">{a.text}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {a.outlet} · {fromNow(a.at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ active, onClick, dot, children }: { active: boolean; onClick: () => void; dot?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dot)} />}
      {children}
    </button>
  );
}
