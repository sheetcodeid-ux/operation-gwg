"use client";

import * as React from "react";
import { Area, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText, Image as ImageIcon, Loader2, Paperclip, PenLine, Target as TargetIcon, TrendingUp, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DataTable } from "@/components/ui/data-table";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, useSheetControl } from "@/components/ui/sheet";
import { getKpiBoardAction, saveKpiEntryAction, uploadKpiEvidenceAction } from "@/lib/actions/hc-kpi";
import {
  KPI_INDICATORS,
  KPI_MONTHS,
  buildRows,
  kpiCategory,
  kpiPeriod,
  kpiPeriodLabel,
  totalScore,
  type KpiAttachment,
  type KpiEntry,
  type KpiKey,
  type KpiRow,
} from "@/lib/hc-kpi";

const BLUE = "#3b82f6";
const GREY = "#94a3b8";
const SLICE = ["#3b82f6", "#f59e0b", "#06b6d4", "#8b5cf6", "#10b981", "#f43f5e"];
const R = 66;
const STROKE = 22;
const CIRC = 2 * Math.PI * R;

const TONE_CLASS: Record<string, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  brand: "text-blue-600 dark:text-blue-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};

const num = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const pct = (n: number) => `${num(Math.round(n * 100) / 100)}%`;

/** Kartu pembungkus — sama persis dengan kartu chart di Work Tracker. */
function Panel({ title, subtitle, children, className }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col rounded-2xl border border-border bg-card/40 p-5", className)}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function KpiBoard({ canEdit }: { canEdit: boolean }) {
  const now = React.useMemo(() => new Date(), []);
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth());
  const period = kpiPeriod(year, month);

  const [entries, setEntries] = React.useState<KpiEntry[]>([]);
  const [trend, setTrend] = React.useState<{ period: string; score: number }[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await getKpiBoardAction(period);
    if ("error" in res) {
      toast.error(res.error);
      setEntries([]);
      setTrend([]);
    } else {
      setEntries(res.entries);
      setTrend(res.trend);
    }
    setLoading(false);
  }, [period]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const rows = React.useMemo(() => {
    const map = Object.fromEntries(entries.map((e) => [e.key, e])) as Partial<Record<KpiKey, KpiEntry>>;
    return buildRows(map);
  }, [entries]);

  const score = totalScore(rows);
  const cat = kpiCategory(score);
  const filled = rows.filter((r) => r.filled).length;
  const belowTarget = rows.filter((r) => r.filled && r.capaian < 100);

  const yearOpts = React.useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1].map((v) => ({ value: String(v), label: String(v) }));
  }, [now]);

  return (
    <div>
      {/* Filter — model dropdown sama dengan Work Tracker */}
      <div className="scroll-fade-x -mx-1 mb-4 flex items-center gap-2 px-1 py-0.5">
        <Combobox
          portal
          searchable={false}
          className="w-36 shrink-0"
          value={String(month)}
          onChange={(v) => setMonth(Number(v))}
          options={KPI_MONTHS.map((m, i) => ({ value: String(i), label: m }))}
        />
        <Combobox
          portal
          searchable={false}
          className="w-28 shrink-0"
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
          options={yearOpts}
        />
        {loading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {/* Ringkasan skor */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <Panel title="Capaian per Indikator" subtitle={`${kpiPeriodLabel(period)} · target vs realisasi`}>
          <div className="min-h-[17rem] flex-1" style={{ outline: "none" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={rows.map((r) => ({ name: r.indicator.short, capaian: Math.round(r.capaian), bobot: r.indicator.weight, aktual: r.aktual, full: r.indicator.name }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
                <defs>
                  <linearGradient id="kpiBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="kpiGrey" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GREY} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={GREY} stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }} tickLine={false} axisLine={false} interval={0} height={22} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} width={34} unit="%" />
                <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={<ChartTip />} />
                <Bar dataKey="bobot" name="Bobot" fill="url(#kpiGrey)" radius={[3, 3, 0, 0]} maxBarSize={34} />
                <Area type="monotone" dataKey="capaian" name="Capaian" stroke={BLUE} strokeWidth={2.5} fill="url(#kpiBlue)" dot={{ r: 3, fill: BLUE }} activeDot={{ r: 5 }} className="chart-glow-blue" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <ContributionDonut rows={rows} score={score} category={cat} />
      </div>

      {/* Tren total skor */}
      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <Panel title="Tren Total Skor KPI" subtitle="Enam periode terakhir">
          <div className="h-[13rem]" style={{ outline: "none" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend.map((t) => ({ name: kpiPeriodLabel(t.period).split(" ")[0].slice(0, 3), skor: t.score, full: kpiPeriodLabel(t.period) }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--foreground)", fontSize: 10, fontWeight: 600 }} tickLine={false} axisLine={false} interval={0} height={22} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} width={34} unit="%" />
                <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={<TrendTip />} />
                <Area type="monotone" dataKey="skor" stroke={BLUE} strokeWidth={2.5} fill="url(#kpiBlue)" dot={{ r: 3, fill: BLUE }} activeDot={{ r: 5 }} className="chart-glow-blue" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Tindak Lanjut" subtitle={cat.label}>
          <div className="flex flex-1 flex-col gap-3">
            <p className="text-xs leading-relaxed text-muted-foreground">{cat.action}</p>
            {belowTarget.length === 0 ? (
              <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                {filled === 0 ? "Belum ada realisasi yang diisi untuk periode ini." : "Seluruh indikator yang terisi sudah mencapai target."}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {belowTarget.map((r) => (
                  <li key={r.key} className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-200">
                    <TrendingUp className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      <strong>{r.indicator.name}</strong> — {pct(r.capaian)} dari target ({num(r.realisasi)} / {num(r.target)} {r.indicator.unit}).
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
              <span className="text-xs text-muted-foreground">Indikator terisi</span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{filled}/{rows.length}</span>
            </div>
          </div>
        </Panel>
      </div>

      <KpiTable rows={rows} period={period} canEdit={canEdit} onSaved={load} />
    </div>
  );
}

/* ─────────────────────────── donut kontribusi ─────────────────────────── */

function ContributionDonut({ rows, score, category }: { rows: KpiRow[]; score: number; category: ReturnType<typeof kpiCategory> }) {
  const [activeKey, setActiveKey] = React.useState<KpiKey | null>(null);
  const slices = rows.map((r, i) => ({ key: r.key, label: r.indicator.name, value: r.aktual, color: SLICE[i % SLICE.length] }));
  const total = slices.reduce((a, s) => a + s.value, 0);
  const active = slices.find((s) => s.key === activeKey) ?? null;

  const arcs = React.useMemo(() => {
    let acc = 0;
    return slices
      .filter((s) => s.value > 0)
      .map((s) => {
        const len = total ? (s.value / total) * CIRC : 0;
        const rot = -90 + (acc / CIRC) * 360;
        acc += len;
        return { key: s.key, color: s.color, len, rot };
      });
  }, [slices, total]);

  return (
    <Panel title="Kontribusi ke Total Skor" subtitle="% Aktual = Bobot × Capaian">
      <div className="flex flex-1 items-center gap-4 py-2">
        <div className="relative h-44 w-44 shrink-0">
          <svg viewBox="0 0 176 176" className="h-full w-full">
            {arcs.length === 0 ? (
              <circle cx={88} cy={88} r={R} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth={STROKE} />
            ) : (
              arcs.map((a) => (
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
                  style={{ opacity: active && a.key !== active.key ? 0.55 : 1 }}
                  onMouseEnter={() => setActiveKey(a.key)}
                  onMouseLeave={() => setActiveKey(null)}
                  onClick={() => setActiveKey(a.key)}
                />
              ))
            )}
          </svg>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <p className={cn("text-[2rem] font-extrabold leading-none tracking-tight", TONE_CLASS[category.tone])}>
                {active ? pct(active.value) : `${num(score)}%`}
              </p>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">{active ? active.label : category.label}</p>
            </div>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-2">
          {slices.map((s) => (
            <li
              key={s.key}
              onMouseEnter={() => setActiveKey(s.key)}
              onMouseLeave={() => setActiveKey(null)}
              onClick={() => setActiveKey(s.key)}
              className="flex cursor-pointer items-start gap-2 text-xs"
            >
              <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className={active?.key === s.key ? "font-medium text-foreground" : "text-foreground/85"}>{s.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        <span className="text-xs text-muted-foreground">Total Skor KPI</span>
        <span className={cn("text-sm font-bold tabular-nums", TONE_CLASS[category.tone])}>{num(score)}%</span>
      </div>
    </Panel>
  );
}

/* ─────────────────────────── tooltip chart ─────────────────────────── */

type TipRow = { full: string; capaian: number; bobot: number; aktual: number };
function ChartTip({ active, payload }: { active?: boolean; payload?: { payload: TipRow }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{d.full}</p>
      <p className="flex items-center gap-2 text-muted-foreground">
        <span className="size-2 rounded-full" style={{ background: BLUE }} /> Capaian
        <span className="ml-auto font-semibold text-foreground">{pct(d.capaian)}</span>
      </p>
      <p className="flex items-center gap-2 text-muted-foreground">
        <span className="size-2 rounded-full bg-slate-400" /> Bobot
        <span className="ml-auto font-semibold text-foreground">{d.bobot}%</span>
      </p>
      <p className="mt-0.5 border-t border-border/60 pt-1 text-muted-foreground">
        % Aktual <span className="ml-auto font-semibold text-foreground">{pct(d.aktual)}</span>
      </p>
    </div>
  );
}

function TrendTip({ active, payload }: { active?: boolean; payload?: { payload: { full: string; skor: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground">{d.full}</p>
      <p className="text-muted-foreground">Total skor <span className="font-semibold text-foreground">{pct(d.skor)}</span></p>
    </div>
  );
}

/* ─────────────────────────── tabel KPI ─────────────────────────── */

function KpiTable({ rows, period, canEdit, onSaved }: { rows: KpiRow[]; period: string; canEdit: boolean; onSaved: () => void }) {
  const columns = React.useMemo<ColumnDef<KpiRow>[]>(
    () => [
      { id: "no", header: "No", cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{row.original.indicator.no}</span> },
      {
        accessorFn: (r) => r.indicator.name,
        id: "indikator",
        header: "Indikator",
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[16rem]">
            <p className="truncate font-medium text-foreground">{row.original.indicator.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{row.original.indicator.criteria}</p>
          </div>
        ),
      },
      { accessorFn: (r) => r.indicator.weight, id: "bobot", header: "Bobot", cell: ({ row }) => <span className="tabular-nums">{row.original.indicator.weight}%</span> },
      { accessorFn: (r) => r.indicator.unit, id: "satuan", header: "Satuan", cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span> },
      { accessorKey: "target", header: "Target", cell: ({ row }) => <span className="tabular-nums">{num(row.original.target)}</span> },
      { accessorKey: "realisasi", header: "REALISASI", cell: ({ row }) => <span className="font-medium tabular-nums text-foreground">{num(row.original.realisasi)}</span> },
      {
        accessorKey: "selisih",
        header: "Selisih",
        cell: ({ row }) => {
          const r = row.original;
          const good = r.indicator.lowerIsBetter ? r.selisih <= 0 : r.selisih >= 0;
          return <span className={cn("tabular-nums", r.filled ? (good ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : "text-muted-foreground")}>{r.selisih > 0 ? "+" : ""}{num(r.selisih)}</span>;
        },
      },
      {
        accessorKey: "capaian",
        header: "% Capaian",
        cell: ({ row }) => {
          const c = row.original.capaian;
          return <Badge tone={c >= 100 ? "success" : c >= 80 ? "cyan" : c > 0 ? "warning" : "neutral"}>{pct(c)}</Badge>;
        },
      },
      { accessorKey: "aktual", header: "% Aktual", cell: ({ row }) => <span className="font-semibold tabular-nums text-foreground">{pct(row.original.aktual)}</span> },
      {
        id: "bukti",
        header: "Bukti",
        enableSorting: false,
        cell: ({ row }) => {
          const items = row.original.attachments;
          if (items.length === 0) return <span className="text-[11px] text-muted-foreground">—</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {items.map((a, i) => (
                <EvidenceChip key={i} a={a} />
              ))}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) =>
          canEdit ? (
            <div className="flex justify-end">
              <KpiEntrySheet row={row.original} period={period} onSaved={onSaved} />
            </div>
          ) : null,
      },
    ],
    [canEdit, period, onSaved],
  );

  return <DataTable tableId="hc-kpi" columns={columns} data={rows} searchPlaceholder="Cari indikator…" pageSize={10} stickyHeader={false} showExport />;
}

function EvidenceChip({ a }: { a: KpiAttachment }) {
  const isPdf = a.name.toLowerCase().endsWith(".pdf");
  const Icon = isPdf ? FileText : ImageIcon;
  const tone = isPdf ? "text-red-500" : "text-blue-500";
  if (!a.url) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
        <Paperclip className="size-3" /> <span className="max-w-[7rem] truncate">{a.name}</span>
      </span>
    );
  }
  return (
    <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border bg-background/40 px-1.5 py-0.5 text-[11px] text-foreground/80 hover:bg-muted/50">
      <Icon className={cn("size-3 shrink-0", tone)} /> <span className="max-w-[7rem] truncate">{a.name}</span>
    </a>
  );
}

/* ─────────────────────────── form input ─────────────────────────── */

function KpiEntrySheet({ row, period, onSaved }: { row: KpiRow; period: string; onSaved: () => void }) {
  return (
    <Sheet>
      <SheetTrigger>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <PenLine className="size-3.5" /> Isi
        </button>
      </SheetTrigger>
      <SheetContent title={row.indicator.name} description={`Realisasi ${kpiPeriodLabel(period)} · bobot ${row.indicator.weight}% · satuan ${row.indicator.unit}`} className="max-w-lg">
        <KpiEntryForm row={row} period={period} onSaved={onSaved} />
      </SheetContent>
    </Sheet>
  );
}

function KpiEntryForm({ row, period, onSaved }: { row: KpiRow; period: string; onSaved: () => void }) {
  const { setOpen } = useSheetControl();
  const [target, setTarget] = React.useState(String(row.target));
  const [realisasi, setRealisasi] = React.useState(String(row.realisasi));
  const [note, setNote] = React.useState(row.note);
  const [kept, setKept] = React.useState<KpiAttachment[]>(row.attachments);
  const [files, setFiles] = React.useState<File[]>([]);
  const [busy, setBusy] = React.useState(false);

  const t = Number(target) || 0;
  const r = Number(realisasi) || 0;
  const capaian = t > 0 && r > 0 ? (row.indicator.lowerIsBetter ? (t / r) * 100 : (r / t) * 100) : 0;
  const aktual = (row.indicator.weight * Math.min(capaian, 100)) / 100;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      if (f.type !== "application/pdf" && !f.type.startsWith("image/")) {
        toast.error(`"${f.name}" harus PDF atau gambar.`);
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`"${f.name}" melebihi 10 MB.`);
        continue;
      }
      ok.push(f);
    }
    setFiles((prev) => [...prev, ...ok].slice(0, 10));
  }

  async function submit() {
    if (t <= 0) return toast.error("Target harus lebih dari 0.");
    setBusy(true);
    try {
      const attachments: KpiAttachment[] = [...kept];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await uploadKpiEvidenceAction(fd);
        if (up.error) return toast.error(up.error);
        if (up.path && up.name) attachments.push({ path: up.path, name: up.name });
      }
      const res = await saveKpiEntryAction({ period, key: row.key, target: t, realisasi: r, note, attachments });
      if (res.error) return toast.error(res.error);
      toast.success("Realisasi tersimpan");
      setOpen(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-h-[76vh] space-y-3 overflow-y-auto p-5">
      <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground">
        <p><span className="font-medium text-foreground">Cara pengukuran:</span> {row.indicator.measure}</p>
        <p className="mt-1"><span className="font-medium text-foreground">Kriteria:</span> {row.indicator.criteria}</p>
        <p className="mt-1"><span className="font-medium text-foreground">Bukti pendukung:</span> {row.indicator.evidence}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={`Target (${row.indicator.unit})`}>
          <Input type="number" min={0} step="any" value={target} onChange={(e) => setTarget(e.target.value)} />
        </Field>
        <Field label={`Realisasi (${row.indicator.unit})`}>
          <Input type="number" min={0} step="any" value={realisasi} onChange={(e) => setRealisasi(e.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">% Capaian</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{pct(capaian)}</p>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">% Aktual (bobot {row.indicator.weight}%)</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{pct(aktual)}</p>
        </div>
      </div>

      <Field label="Narasi / Penjelasan" hint="Wajib bila indikator tidak mencapai target.">
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: dari target 4 program, terlaksana 3 program. Program yang tertunda dijadwalkan ulang minggu depan…" />
      </Field>

      <Field label="Bukti Pendukung (PDF / JPG / PNG)" hint="Maks 10 MB per berkas, hingga 10 berkas.">
        <div className="space-y-2">
          <label className={cn("inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-background/40 px-3 py-2 text-sm text-foreground/80 hover:bg-muted/50", busy && "pointer-events-none opacity-50")}>
            <Upload className="size-4" /> Unggah bukti
            <input type="file" accept="application/pdf,image/*" multiple className="hidden" disabled={busy} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </label>
          {(kept.length > 0 || files.length > 0) && (
            <ul className="space-y-1.5">
              {kept.map((a, i) => (
                <li key={`k-${i}`} className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-foreground/80">
                  <Paperclip className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <button type="button" onClick={() => setKept((k) => k.filter((_, j) => j !== i))} className="shrink-0 text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
                </li>
              ))}
              {files.map((f, i) => (
                <li key={`n-${i}`} className="flex items-center gap-2 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs text-foreground/80">
                  {f.type === "application/pdf" ? <FileText className="size-3.5 shrink-0 text-red-500" /> : <ImageIcon className="size-3.5 shrink-0 text-blue-500" />}
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="shrink-0 text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} className="shrink-0 text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
        <Button onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <TargetIcon className="size-4" />} Simpan Realisasi
        </Button>
      </div>
    </div>
  );
}

export { KPI_INDICATORS };
