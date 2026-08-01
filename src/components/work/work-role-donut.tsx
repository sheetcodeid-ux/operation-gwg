"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { DivisionMembers } from "./task-sheet";
import type { WorkRow } from "./work-table";

// Warna slice donut — palet multi-hue yang selaras dgn tema aplikasi.
const COLORS = ["#3b82f6", "#f59e0b", "#06b6d4", "#8b5cf6", "#10b981", "#f43f5e", "#64748b", "#eab308"];

type Slice = { jabatan: string; value: number };

/**
 * Donut distribusi tugas per JABATAN dalam sebuah departemen (mis. Operational →
 * System Support, Coordinator Area East/West, Head). Nilai = jumlah penugasan
 * (PIC) per jabatan. Desain mengikuti kartu "Spending by Category": donut dengan
 * ujung membulat + gap, angka % besar di tengah yang BERUBAH saat sebuah slice
 * dipilih/di-tap (tanpa tooltip), legenda kanan, dan deret bulatan bertumpuk +
 * total di bawah.
 */
export function WorkRoleDonut({ rows, members, department }: { rows: WorkRow[]; members?: DivisionMembers; department: string }) {
  const list = React.useMemo(() => members?.[department] ?? [], [members, department]);
  const [activeJabatan, setActiveJabatan] = React.useState<string | null>(null);

  const { all, slices, total } = React.useMemo(() => {
    const jabatanById = new Map(list.map((m) => [m.id, (m.jabatan && m.jabatan.trim()) || "Lainnya"]));
    const counts = new Map<string, number>();
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
    return { all, slices, total };
  }, [list, rows, department]);

  const colorOf = React.useCallback((jabatan: string) => COLORS[Math.max(0, all.findIndex((s) => s.jabatan === jabatan)) % COLORS.length], [all]);

  // Slice aktif = yang di-hover/di-tap; default = terbesar. Angka di tengah ikut ini.
  const active = all.find((s) => s.jabatan === activeJabatan) ?? slices[0] ?? all[0];
  const activePct = total && active ? Math.round((active.value / total) * 100) : 0;

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
            <div className="relative h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="jabatan"
                    innerRadius={60}
                    outerRadius={82}
                    paddingAngle={1}
                    cornerRadius={12}
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                    isAnimationActive={false}
                    onMouseEnter={(_, i) => setActiveJabatan(slices[i]?.jabatan ?? null)}
                    onMouseLeave={() => setActiveJabatan(null)}
                    onClick={(_, i) => setActiveJabatan(slices[i]?.jabatan ?? null)}
                  >
                    {slices.map((s) => (
                      <Cell key={s.jabatan} fill={colorOf(s.jabatan)} opacity={active && s.jabatan === active.jabatan ? 1 : 0.9} className="cursor-pointer outline-none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Angka tengah — hanya persentase, BERUBAH mengikuti slice aktif. */}
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <p className="text-[2rem] font-extrabold leading-none tracking-tight" style={{ color: colorOf(active.jabatan) }}>{activePct}%</p>
              </div>
            </div>

            {/* Legenda — dot + nama saja (nama panjang turun ke bawah), tanpa angka. */}
            <ul className="min-w-0 flex-1 space-y-2">
              {all.map((s) => (
                <li
                  key={s.jabatan}
                  onMouseEnter={() => setActiveJabatan(s.jabatan)}
                  onMouseLeave={() => setActiveJabatan(null)}
                  onClick={() => setActiveJabatan(s.jabatan)}
                  className="flex cursor-pointer items-start gap-2 text-xs"
                >
                  <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: colorOf(s.jabatan) }} />
                  <span className={active && s.jabatan === active.jabatan ? "font-medium text-foreground" : "text-foreground/85"}>{s.jabatan}</span>
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
