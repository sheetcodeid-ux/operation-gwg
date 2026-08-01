"use client";

import * as React from "react";
import type { DivisionMembers } from "./task-sheet";
import type { WorkRow } from "./work-table";

// Warna slice donut — palet multi-hue yang selaras dgn tema aplikasi.
const COLORS = ["#3b82f6", "#f59e0b", "#06b6d4", "#8b5cf6", "#10b981", "#f43f5e", "#64748b", "#eab308"];
const CIRC = 2 * Math.PI * 66; // keliling lingkaran (r=66) untuk stroke-dasharray

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

  // Busur per slice, mulai dari atas (−90°) searah jarum jam. Ujung membulat +
  // digambar berurutan → tiap arc menimpa tetangganya (efek "menyatu").
  const arcs = React.useMemo(() => {
    let acc = 0;
    return slices.map((s) => {
      const len = total ? (s.value / total) * CIRC : 0;
      const rot = -90 + (acc / CIRC) * 360;
      acc += len;
      return { jabatan: s.jabatan, color: colorOf(s.jabatan), len, rot };
    });
  }, [slices, total, colorOf]);

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card/40 p-5">
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
              {/* Custom SVG: tiap slice = arc lingkaran dgn ujung MEMBULAT
                  (stroke-linecap round) yang saling menimpa/terhubung persis
                  seperti referensi "Spending by Category". */}
              <svg viewBox="0 0 176 176" className="h-full w-full">
                {arcs.map((a) => (
                  <circle
                    key={a.jabatan}
                    cx={88}
                    cy={88}
                    r={66}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={22}
                    strokeLinecap="round"
                    strokeDasharray={`${a.len} ${CIRC - a.len}`}
                    transform={`rotate(${a.rot} 88 88)`}
                    className="cursor-pointer transition-opacity"
                    style={{ opacity: active && a.jabatan === active.jabatan ? 1 : 0.9 }}
                    onMouseEnter={() => setActiveJabatan(a.jabatan)}
                    onMouseLeave={() => setActiveJabatan(null)}
                    onClick={() => setActiveJabatan(a.jabatan)}
                  />
                ))}
              </svg>
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

          <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-4">
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
