"use client";

import * as React from "react";
import { Activity, Flag, Network } from "lucide-react";
import { PRIORITY_META, TASK_STATUS_META } from "@/lib/constants";
import type { Priority, TaskStatus } from "@/lib/types";
import { TONE_HEX } from "@/components/ui/tone";
import { cn } from "@/lib/utils";
import type { DivisionMembers } from "./task-sheet";
import type { WorkRow } from "./work-table";

// Warna slice untuk mode Jabatan — palet multi-hue selaras tema.
const COLORS = ["#3b82f6", "#f59e0b", "#06b6d4", "#8b5cf6", "#10b981", "#f43f5e", "#64748b", "#eab308"];
const R = 66; // radius cincin
const STROKE = 22; // tebal cincin
const CIRC = 2 * Math.PI * R; // keliling — untuk stroke-dasharray

type Mode = "jabatan" | "priority" | "status";
const MODES = [
  { id: "jabatan", label: "Jabatan", icon: Network },
  { id: "priority", label: "Prioritas", icon: Flag },
  { id: "status", label: "Status", icon: Activity },
] as const;
const MODE_TITLE: Record<Mode, string> = { jabatan: "Jabatan", priority: "Prioritas", status: "Status" };

type Item = { key: string; label: string; value: number; color: string };

/**
 * Donut distribusi tugas dalam sebuah departemen dengan 3 tampilan yang bisa
 * ditekan (segmented toggle ala "Performance / Trends"):
 *  • Jabatan  — jumlah penugasan (PIC) per jabatan (System Support, Head, …)
 *  • Prioritas — jumlah task per prioritas (warna semantik)
 *  • Status   — jumlah task per status (warna semantik)
 * Angka % besar di tengah berubah saat slice/legenda dipilih.
 */
export function WorkRoleDonut({ rows, members, department }: { rows: WorkRow[]; members?: DivisionMembers; department: string }) {
  const list = React.useMemo(() => members?.[department] ?? [], [members, department]);
  const [mode, setMode] = React.useState<Mode>("jabatan");
  const [activeKey, setActiveKey] = React.useState<string | null>(null);

  const all = React.useMemo<Item[]>(() => {
    const deptRows = rows.filter((r) => r.division === department);
    if (mode === "priority") {
      const counts = new Map<string, number>();
      for (const r of deptRows) counts.set(r.priority, (counts.get(r.priority) ?? 0) + 1);
      return (Object.keys(PRIORITY_META) as Priority[])
        .filter((p) => counts.has(p))
        .map((p) => ({ key: p, label: PRIORITY_META[p].label, value: counts.get(p)!, color: TONE_HEX[PRIORITY_META[p].tone] }))
        .sort((a, b) => b.value - a.value);
    }
    if (mode === "status") {
      const counts = new Map<string, number>();
      for (const r of deptRows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
      return (Object.keys(TASK_STATUS_META) as TaskStatus[])
        .filter((s) => counts.has(s))
        .map((s) => ({ key: s, label: TASK_STATUS_META[s].label, value: counts.get(s)!, color: TONE_HEX[TASK_STATUS_META[s].tone] }))
        .sort((a, b) => b.value - a.value);
    }
    // jabatan
    const jabatanById = new Map(list.map((m) => [m.id, (m.jabatan && m.jabatan.trim()) || "Lainnya"]));
    const counts = new Map<string, number>();
    for (const m of list) {
      const j = (m.jabatan && m.jabatan.trim()) || "Lainnya";
      if (!counts.has(j)) counts.set(j, 0);
    }
    for (const r of deptRows) for (const pid of r.picIds) {
      const j = jabatanById.get(pid) ?? "Lainnya";
      counts.set(j, (counts.get(j) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .map((x, i) => ({ key: x.label, label: x.label, value: x.value, color: COLORS[i % COLORS.length] }));
  }, [rows, department, list, mode]);

  const slices = React.useMemo(() => all.filter((s) => s.value > 0), [all]);
  const total = slices.reduce((a, s) => a + s.value, 0);
  const colorOf = React.useCallback((key: string) => all.find((s) => s.key === key)?.color ?? "#94a3b8", [all]);

  // Slice aktif = yang di-hover/di-tap; default = terbesar. Angka di tengah ikut ini.
  const active = all.find((s) => s.key === activeKey) ?? slices[0] ?? all[0];
  const activePct = total && active ? Math.round((active.value / total) * 100) : 0;

  // Busur per slice, mulai dari atas (−90°). Ujung membulat + digambar berurutan
  // → tiap arc menimpa tetangganya (efek "menyatu").
  const arcs = React.useMemo(() => {
    let acc = 0;
    return slices.map((s) => {
      const len = total ? (s.value / total) * CIRC : 0;
      const rot = -90 + (acc / CIRC) * 360;
      acc += len;
      return { key: s.key, color: s.color, len, rot };
    });
  }, [slices, total]);

  const empty = list.length === 0 && mode === "jabatan" ? "Belum ada anggota di departemen ini." : "Belum ada task untuk departemen ini.";

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card/40 p-5">
      <div className="mb-3 flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Distribusi Tugas per {MODE_TITLE[mode]}</h3>
          <p className="text-[11px] text-muted-foreground">{department || "—"}</p>
        </div>
        {/* Segmented toggle — Jabatan / Prioritas / Status. */}
        <div className="inline-flex w-fit rounded-xl border border-border bg-muted/50 p-1">
          {MODES.map((m) => {
            const on = mode === m.id;
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => { setMode(m.id); setActiveKey(null); }}
                aria-pressed={on}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  on ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {total === 0 ? (
        <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center text-xs text-muted-foreground">
          {empty}
        </div>
      ) : (
        <>
          <div className="flex flex-1 items-center gap-4 py-2">
            <div className="relative h-44 w-44 shrink-0">
              <svg viewBox="0 0 176 176" className="h-full w-full">
                {arcs.map((a) => (
                  <circle
                    key={a.key}
                    cx={88}
                    cy={88}
                    r={R}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={`${a.len} ${CIRC - a.len}`}
                    transform={`rotate(${a.rot} 88 88)`}
                    className="cursor-pointer transition-opacity"
                    style={{ opacity: active && a.key === active.key ? 1 : 0.9 }}
                    onMouseEnter={() => setActiveKey(a.key)}
                    onMouseLeave={() => setActiveKey(null)}
                    onClick={() => setActiveKey(a.key)}
                  />
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <p className="text-[2rem] font-extrabold leading-none tracking-tight" style={{ color: colorOf(active.key) }}>{activePct}%</p>
              </div>
            </div>

            <ul className="min-w-0 flex-1 space-y-2">
              {all.map((s) => (
                <li
                  key={s.key}
                  onMouseEnter={() => setActiveKey(s.key)}
                  onMouseLeave={() => setActiveKey(null)}
                  onClick={() => setActiveKey(s.key)}
                  className="flex cursor-pointer items-start gap-2 text-xs"
                >
                  <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className={active && s.key === active.key ? "font-medium text-foreground" : "text-foreground/85"}>{s.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between border-t border-border/60 pt-4">
            <span className="text-xs text-muted-foreground">Total Task</span>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {slices.slice(0, 5).map((s) => (
                  <span key={s.key} className="size-4 rounded-full ring-2 ring-card" style={{ background: s.color }} />
                ))}
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">{total}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
