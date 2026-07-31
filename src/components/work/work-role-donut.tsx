"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DivisionMembers } from "./task-sheet";
import type { WorkRow } from "./work-table";

// Warna slice donut — palet multi-hue yang selaras dgn tema aplikasi.
const COLORS = ["#3b82f6", "#f59e0b", "#06b6d4", "#8b5cf6", "#10b981", "#f43f5e", "#64748b", "#eab308"];

type Slice = { jabatan: string; value: number };

function Tip({ active, payload, total }: { active?: boolean; payload?: { payload: Slice }[]; total: number }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = total ? Math.round((d.value / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground">{d.jabatan}</p>
      <p className="text-muted-foreground">{d.value} task · {pct}%</p>
    </div>
  );
}

/**
 * Donut distribusi tugas per JABATAN dalam sebuah departemen (mis. Operational →
 * Head, Coordinator Area East/West, System Support). Nilai = jumlah penugasan
 * (PIC) per jabatan. Desain mengikuti kartu "Spending by Category" (donut +
 * angka besar di tengah, legenda kanan, deret bulatan bertumpuk + total bawah).
 */
export function WorkRoleDonut({ rows, members, department }: { rows: WorkRow[]; members?: DivisionMembers; department: string }) {
  const list = React.useMemo(() => members?.[department] ?? [], [members, department]);

  const { all, slices, total, topName, topPct } = React.useMemo(() => {
    const jabatanById = new Map(list.map((m) => [m.id, (m.jabatan && m.jabatan.trim()) || "Lainnya"]));
    const counts = new Map<string, number>();
    // Semua jabatan yang punya anggota tetap tampil di legenda (walau 0 task).
    for (const m of list) {
      const j = (m.jabatan && m.jabatan.trim()) || "Lainnya";
      if (!counts.has(j)) counts.set(j, 0);
    }
    const deptRows = rows.filter((r) => r.division === department);
    for (const r of deptRows) {
      for (const pid of r.picIds) {
        const j = jabatanById.get(pid) ?? "Lainnya";
        counts.set(j, (counts.get(j) ?? 0) + 1);
      }
    }
    const all = [...counts.entries()].map(([jabatan, value]) => ({ jabatan, value })).sort((a, b) => b.value - a.value);
    const slices = all.filter((s) => s.value > 0);
    const total = slices.reduce((a, s) => a + s.value, 0);
    const top = slices[0];
    return { all, slices, total, topName: top?.jabatan ?? "", topPct: total && top ? Math.round((top.value / total) * 100) : 0 };
  }, [list, rows, department]);

  const colorOf = (jabatan: string) => COLORS[Math.max(0, all.findIndex((s) => s.jabatan === jabatan)) % COLORS.length];

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Distribusi Tugas per Jabatan</h3>
        <p className="text-[11px] text-muted-foreground">{department || "—"}</p>
      </div>

      {list.length === 0 || total === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center text-xs text-muted-foreground">
          {list.length === 0 ? "Belum ada anggota di departemen ini." : "Belum ada task untuk departemen ini."}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <div className="relative h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="value" nameKey="jabatan" innerRadius={52} outerRadius={72} paddingAngle={3} cornerRadius={8} stroke="none" startAngle={90} endAngle={-270}>
                    {slices.map((s) => <Cell key={s.jabatan} fill={colorOf(s.jabatan)} />)}
                  </Pie>
                  <Tooltip content={<Tip total={total} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div className="px-6">
                  <p className="text-2xl font-bold leading-none" style={{ color: colorOf(topName) }}>{topPct}%</p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">{topName}</p>
                </div>
              </div>
            </div>

            <ul className="min-w-0 flex-1 space-y-1.5">
              {all.map((s) => (
                <li key={s.jabatan} className="flex items-center gap-2 text-xs">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorOf(s.jabatan) }} />
                  <span className="truncate text-foreground/90">{s.jabatan}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{s.value}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
            <span className="text-xs text-muted-foreground">Total Task</span>
            <div className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {slices.slice(0, 5).map((s) => (
                  <span key={s.jabatan} className="size-4 rounded-full ring-2 ring-card" style={{ background: colorOf(s.jabatan) }} />
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
