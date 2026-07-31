"use client";

import * as React from "react";
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { membersForDivision } from "./division-filter";
import type { DivisionMembers } from "./task-sheet";
import type { WorkRow } from "./work-table";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BLUE = "#3b82f6";
const pad = (n: number) => String(n).padStart(2, "0");

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
 * vs bulan sebelumnya. Per DEPARTEMEN (tidak digabung): sumbu X = nama karyawan
 * di departemen itu. Gaya chart: bar abu-abu (bulan lalu) + area gradient biru
 * dengan garis & titik (bulan ini).
 */
export function WorkPerformanceChart({ rows, members, divisions, isAdmin, defaultDivision }: { rows: WorkRow[]; members?: DivisionMembers; divisions?: string[]; isAdmin?: boolean; defaultDivision?: string }) {
  const now = new Date();
  const [month, setMonth] = React.useState(now.getMonth());
  const deptOptions = (divisions ?? []).filter((d) => d && d !== "all");
  const [dept, setDept] = React.useState(defaultDivision && deptOptions.includes(defaultDivision) ? defaultDivision : deptOptions[0] ?? defaultDivision ?? "");

  const year = now.getFullYear();
  const thisKey = `${year}-${pad(month + 1)}`;
  const last = new Date(year, month - 1, 1);
  const lastKey = `${last.getFullYear()}-${pad(last.getMonth() + 1)}`;

  const emps = React.useMemo(() => membersForDivision(members, dept), [members, dept]);
  const data = React.useMemo<Row[]>(() => {
    const deptRows = rows.filter((r) => r.division === dept);
    return emps.map((e) => {
      let ini = 0, lalu = 0;
      for (const r of deptRows) {
        if (!r.picIds.includes(e.id)) continue;
        const key = (r.startDate || "").slice(0, 7);
        if (key === thisKey) ini++;
        else if (key === lastKey) lalu++;
      }
      return { name: abbr(e.name), full: e.name, ini, lalu };
    });
  }, [rows, emps, dept, thisKey, lastKey]);

  const hasEmployees = emps.length > 0;
  const hasAny = data.some((d) => d.ini > 0 || d.lalu > 0);

  return (
    <div className="mb-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-500/12"><Users className="size-4 text-blue-600 dark:text-blue-400" /></span>
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-foreground">Kinerja Karyawan</h3>
            <p className="text-[11px] text-muted-foreground">Jumlah task per karyawan · bulan ini vs bulan lalu{dept ? ` · ${dept}` : ""}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && deptOptions.length > 0 && (
            <Combobox
              portal
              searchable={false}
              className="w-40 shrink-0"
              value={dept}
              onChange={setDept}
              options={deptOptions.map((d) => ({ value: d, label: d }))}
            />
          )}
          <Combobox
            portal
            searchable={false}
            className="w-36 shrink-0"
            value={String(month)}
            onChange={(v) => setMonth(Number(v))}
            options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
          />
        </div>
      </div>

      {!hasEmployees ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center text-xs text-muted-foreground">Belum ada karyawan di departemen ini.</div>
      ) : (
        <>
          <div className="h-[17rem]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
          {!hasAny && <p className="mt-2 text-center text-[11px] text-muted-foreground">Belum ada task pada {MONTHS[month]} / bulan sebelumnya untuk departemen ini.</p>}
        </>
      )}
    </div>
  );
}
