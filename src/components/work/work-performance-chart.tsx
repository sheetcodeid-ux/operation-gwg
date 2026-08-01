"use client";

import * as React from "react";
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { membersForDivision } from "./division-filter";
import type { DivisionMembers } from "./task-sheet";
import type { WorkRow } from "./work-table";

const BLUE = "#3b82f6";
const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Kartu pembungkus — disamakan dgn kartu donut agar dua kotak sejajar & rapi. */
function Card({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card/40 p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

// Prefiks kehormatan yang dilewati agar nama panggilan yang dipakai
// (mis. "Muhammad Andi" → "Andi" → "AND").
const PREFIXES = new Set(["muhammad", "muhamad", "mohammad", "mohamad", "moch", "mochamad", "mochammad", "muh", "m"]);
/** Singkatan 3 huruf kapital untuk sumbu X — seperti bulan "January" → "JAN". */
function abbr(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return name;
  let w = words[0];
  if (words.length > 1 && PREFIXES.has(words[0].toLowerCase().replace(/\./g, ""))) w = words[1];
  return w.slice(0, 3).toUpperCase();
}

type Row = { name: string; full: string; ini: number; lalu: number };
function Tip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{d.full}</p>
      <p className="flex items-center gap-2 text-muted-foreground"><span className="size-2 rounded-full" style={{ background: BLUE }} /> Bulan ini <span className="ml-auto font-semibold text-foreground">{d.ini} task</span></p>
      <p className="flex items-center gap-2 text-muted-foreground"><span className="size-2 rounded-full bg-slate-400" /> Bulan lalu <span className="ml-auto font-semibold text-foreground">{d.lalu} task</span></p>
    </div>
  );
}

/**
 * Kinerja karyawan — jumlah task per karyawan (sebagai PIC) untuk bulan terpilih
 * vs bulan sebelumnya. Per DEPARTEMEN (dikontrol dari filter di atasnya): sumbu X
 * = nama karyawan di departemen itu, diurutkan terendah → tertinggi (seperti
 * tangga). Gaya chart: bar abu-abu (bulan lalu) + area gradient biru (bulan ini).
 */
export function WorkPerformanceChart({ rows, members, month, department }: { rows: WorkRow[]; members?: DivisionMembers; month: number; department: string }) {
  const year = new Date().getFullYear();
  const thisKey = `${year}-${pad(month + 1)}`;
  const last = new Date(year, month - 1, 1);
  const lastKey = `${last.getFullYear()}-${pad(last.getMonth() + 1)}`;

  const emps = React.useMemo(() => membersForDivision(members, department), [members, department]);
  const data = React.useMemo<Row[]>(() => {
    const deptRows = rows.filter((r) => r.division === department);
    const out = emps.map((e) => {
      let ini = 0, lalu = 0;
      for (const r of deptRows) {
        if (!r.picIds.includes(e.id)) continue;
        const key = (r.startDate || "").slice(0, 7);
        if (key === thisKey) ini++;
        else if (key === lastKey) lalu++;
      }
      return { name: abbr(e.name), full: e.name, ini, lalu };
    });
    // Terendah → tertinggi (kiri ke kanan), seperti tangga. Utamakan bulan ini,
    // lalu bulan lalu sebagai pemecah imbang (saat bulan ini masih 0 semua).
    out.sort((a, b) => a.ini - b.ini || a.lalu - b.lalu);
    return out;
  }, [rows, emps, department, thisKey, lastKey]);

  const hasEmployees = emps.length > 0;
  const hasAny = data.some((d) => d.ini > 0 || d.lalu > 0);
  const subtitle = `${MONTHS[month]} · ${department || "—"}`;

  if (!hasEmployees) {
    return (
      <Card title="Kinerja Karyawan" subtitle={subtitle}>
        <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center text-xs text-muted-foreground">
          Belum ada karyawan di departemen ini.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Kinerja Karyawan" subtitle={subtitle}>
      <div className="h-[17rem]" style={{ outline: "none" }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
            <defs>
              <linearGradient id="wpBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={BLUE} stopOpacity={0.35} /><stop offset="100%" stopColor={BLUE} stopOpacity={0} /></linearGradient>
              <linearGradient id="wpGrey" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#94a3b8" stopOpacity={0.9} /><stop offset="100%" stopColor="#94a3b8" stopOpacity={0.35} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }} tickLine={false} axisLine={false} interval={0} angle={0} textAnchor="middle" height={22} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} width={30} />
            <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={<Tip />} />
            <Bar dataKey="lalu" name="Bulan Lalu" fill="url(#wpGrey)" radius={[3, 3, 0, 0]} maxBarSize={34} />
            <Area type="monotone" dataKey="ini" name="Bulan Ini" stroke={BLUE} strokeWidth={2.5} fill="url(#wpBlue)" dot={{ r: 3, fill: BLUE }} activeDot={{ r: 5 }} className="chart-glow-blue" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {!hasAny && <p className="mt-2 text-center text-[11px] text-muted-foreground">Belum ada task pada bulan ini / bulan sebelumnya untuk departemen ini.</p>}
    </Card>
  );
}
