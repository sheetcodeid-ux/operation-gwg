"use client";

import * as React from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarDays, CheckCircle2, ChevronDown, Download, FileSpreadsheet, Loader2, Minus, ReceiptText, Store, Users, Wallet, X } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip as ChartTooltip, XAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { StatTile } from "@/components/ui/stat";
import { cn, formatIDR, formatIDRShort } from "@/lib/utils";
import { fraudReportAction, fraudSyncAction, outletFraudDailyAction } from "@/lib/actions/fraud";
import type { FraudDailyPoint, FraudKind, FraudOrder, FraudOutletRow, FraudPeriod, FraudReport } from "@/lib/data/fraud";

const PERIODS: { key: FraudPeriod; label: string }[] = [
  { key: "daily", label: "Harian" },
  { key: "weekly", label: "Mingguan" },
  { key: "monthly", label: "Bulanan" },
];
const PERIOD_LABEL: Record<FraudPeriod, string> = { daily: "Harian", weekly: "Mingguan", monthly: "Bulanan" };
const KIND_LABEL: Record<FraudKind, string> = { all: "Void + Cancel", void: "Void", cancel: "Cancel", delete: "Delete Order" };
const KIND_OPTIONS = (Object.keys(KIND_LABEL) as FraudKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }));
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const nf = (n: number) => n.toLocaleString("id-ID");
const ymd = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

type PdfTheme = "light" | "dark";

/** Value shown per metric: Rp nominal when the POS returns it, else the count. */
const metricValue = (hasAmount: boolean, count: number, amount: number) => (hasAmount ? formatIDR(amount) : nf(count));

export function FraudAnalysis({ initial, initialDate }: { initial: FraudReport; initialDate: string }) {
  const [period, setPeriod] = React.useState<FraudPeriod>(initial.period);
  const [date, setDate] = React.useState(initialDate);
  const [kind, setKind] = React.useState<FraudKind>(initial.kind ?? "all");
  const [report, setReport] = React.useState<FraudReport>(initial);
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<"rp" | "trx">("rp");
  const [pdfTheme, setPdfTheme] = React.useState<PdfTheme>("light");
  const [detail, setDetail] = React.useState<{ outlet: FraudOutletRow; day?: string } | null>(null);
  const [prevTotal, setPrevTotal] = React.useState<number | null>(null);
  const [pending, start] = React.useTransition();

  // Remember the PDF theme across visits.
  React.useEffect(() => {
    const t = window.localStorage.getItem("fraud.pdfTheme");
    if (t === "dark" || t === "light") setPdfTheme(t);
  }, []);
  const choosePdfTheme = (t: PdfTheme) => {
    setPdfTheme(t);
    try { window.localStorage.setItem("fraud.pdfTheme", t); } catch { /* private mode */ }
  };

  // Previous-period total for the delta chip (DB read only — never triggers a
  // sync). Skipped when the previous period isn't fully synced yet.
  React.useEffect(() => {
    let live = true;
    setPrevTotal(null);
    const dt = new Date(`${date}T00:00:00`);
    if (period === "daily") dt.setDate(dt.getDate() - 1);
    else if (period === "weekly") dt.setDate(dt.getDate() - 7);
    else { dt.setMonth(dt.getMonth() - 1); dt.setDate(1); }
    const prevDate = ymd(dt.getFullYear(), dt.getMonth(), dt.getDate());
    fraudReportAction(period, prevDate, kind).then((res) => {
      if (!live) return;
      if ("configured" in res && res.configured && res.source === "esb" && !res.pendingDays?.length) {
        setPrevTotal(res.totalVoidAmount + res.totalCancelAmount);
      }
    });
    return () => { live = false; };
  }, [period, date, kind]);
  // Background ESB→DB sync: days left to pull for the current selection. The
  // seq guard cancels a running drain the moment the user changes selection.
  const [syncLeft, setSyncLeft] = React.useState(0);
  const seqRef = React.useRef(0);

  const refresh = React.useCallback(async (p: FraudPeriod, d: string, k: FraudKind, seq: number) => {
    const res = await fraudReportAction(p, d, k);
    if (seqRef.current !== seq) return;
    if ("configured" in res) setReport(res);
  }, []);

  // Silently pre-pull the OTHER type (Void+Cancel ↔ Delete) for the same
  // period so switching "Tipe" is instant too. No UI, cancels on selection.
  const prewarm = React.useCallback(async (p: FraudPeriod, d: string, k: FraudKind) => {
    const seq = seqRef.current;
    const other: FraudKind = k === "delete" ? "all" : "delete";
    for (let i = 0; i < 20 && seqRef.current === seq; i++) {
      const s = await fraudSyncAction(p, d, other);
      if (!("synced" in s) || s.remaining === 0 || s.error || s.synced === 0) break;
    }
  }, []);

  const drainSync = React.useCallback(
    async (p: FraudPeriod, d: string, k: FraudKind, expected: number) => {
      const seq = seqRef.current;
      setSyncLeft(expected);
      for (let i = 0; i < 40 && seqRef.current === seq; i++) {
        const s = await fraudSyncAction(p, d, k);
        if (seqRef.current !== seq) return;
        if (!("synced" in s)) { toast.error(s.error); break; }
        setSyncLeft(s.remaining);
        await refresh(p, d, k, seq); // matrix fills in progressively
        if (s.remaining === 0) break;
        if (s.error) { toast.error(`Sinkron ESB terhenti: ${s.error}`); break; }
        if (s.synced === 0) break; // no forward progress — stop looping
      }
      if (seqRef.current === seq) {
        setSyncLeft(0);
        void prewarm(p, d, k);
      }
    },
    [refresh, prewarm],
  );

  const load = React.useCallback((p: FraudPeriod, d: string, k: FraudKind) => {
    const seq = ++seqRef.current;
    setSyncLeft(0);
    start(async () => {
      const res = await fraudReportAction(p, d, k);
      if (seqRef.current !== seq) return;
      // A FraudReport can itself carry an `error` field, so discriminate on a
      // required report field (configured) rather than the presence of `error`.
      if (!("configured" in res)) {
        toast.error((res as { error: string }).error);
        return;
      }
      setReport(res);
      // DB served instantly; pull any missing days in the background.
      if (res.pendingDays?.length) void drainSync(p, d, k, res.pendingDays.length);
      else if (res.pendingDays) void prewarm(p, d, k);
    });
  }, [drainSync, prewarm]);

  // Initial page load may also carry unsynced days — drain them right away.
  React.useEffect(() => {
    if (initial.pendingDays?.length) {
      seqRef.current += 1;
      void drainSync(initial.period, initialDate, initial.kind ?? "all", initial.pendingDays.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Anchor pickers to the month/year of the initial (today's) date.
  const anchor = React.useMemo(() => new Date(`${initialDate}T00:00:00`), [initialDate]);
  const Y = anchor.getFullYear();
  const M = anchor.getMonth();
  const daysInMonth = new Date(Y, M + 1, 0).getDate();

  const options = React.useMemo(() => {
    if (period === "daily") return Array.from({ length: daysInMonth }, (_, i) => ({ value: ymd(Y, M, i + 1), label: `${i + 1} ${MONTHS[M]}` }));
    if (period === "weekly") {
      const n = Math.ceil(daysInMonth / 7);
      return Array.from({ length: n }, (_, i) => {
        const s = i * 7 + 1;
        const e = Math.min(s + 6, daysInMonth);
        return { value: ymd(Y, M, s), label: `Minggu ${i + 1} (${s}–${e} ${MONTHS[M].slice(0, 3)})` };
      });
    }
    return Array.from({ length: 12 }, (_, m) => ({ value: ymd(Y, m, 1), label: `${MONTHS[m]} ${Y}` }));
  }, [period, Y, M, daysInMonth]);

  const defaultFor = React.useCallback(
    (p: FraudPeriod) => {
      if (p === "daily") return initialDate;
      if (p === "weekly") return ymd(Y, M, Math.floor((anchor.getDate() - 1) / 7) * 7 + 1);
      return ymd(Y, M, 1);
    },
    [initialDate, Y, M, anchor],
  );

  const onPeriod = (p: FraudPeriod) => {
    const d = defaultFor(p);
    setPeriod(p);
    setDate(d);
    setDetail(null);
    load(p, d, kind);
  };
  const onDate = (d: string) => {
    setDate(d);
    setDetail(null);
    load(period, d, kind);
  };
  const onKind = (k: FraudKind) => {
    setKind(k);
    setDetail(null);
    load(period, date, k);
  };

  const hasAmount = report.hasAmount;
  const totalCount = report.totalVoid + report.totalCancel;
  const totalAmount = report.totalVoidAmount + report.totalCancelAmount;
  const hasData = totalCount + totalAmount > 0;

  return (
    <div className="space-y-3">
      {/* Controls — one compact bar, wraps cleanly on mobile */}
      <div className="glass rounded-2xl border border-border p-3.5">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5">
          <div>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">Periode</p>
            <SegmentedTabs size="sm" className="w-64" items={PERIODS.map((p) => ({ value: p.key, label: p.label }))} value={period} onChange={(v) => onPeriod(v as FraudPeriod)} />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">{period === "daily" ? "Tanggal" : period === "weekly" ? "Minggu" : "Bulan"}</p>
            <Combobox matchTriggerWidth searchable={false} value={date} onChange={onDate} options={options} className="w-44" />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">Tipe</p>
            <Combobox matchTriggerWidth searchable={false} value={kind} onChange={(v) => onKind(v as FraudKind)} options={KIND_OPTIONS} className="w-40" />
          </div>
          <div className="min-w-36 flex-1">
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">Cari outlet</p>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nama outlet…"
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-center gap-2">
            {syncLeft > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Loader2 className="size-3 animate-spin" /> Sinkron · sisa {syncLeft} hari
              </span>
            )}
            {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <SegmentedTabs size="sm" className="w-24" items={[{ value: "rp", label: "Rp" }, { value: "trx", label: "Trx" }]} value={mode} onChange={(v) => setMode(v as "rp" | "trx")} />
            <Combobox
              matchTriggerWidth
              searchable={false}
              value={pdfTheme}
              onChange={(v) => choosePdfTheme(v as PdfTheme)}
              options={[{ value: "light", label: "PDF Terang" }, { value: "dark", label: "PDF Gelap" }]}
              className="w-32"
            />
            <Button variant="outline" size="sm" onClick={() => downloadCsv(report)} disabled={!report.configured || report.source !== "esb"} title="Unduh matriks CSV (buka di Excel)">
              <FileSpreadsheet className="size-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadPdf(report, pdfTheme)} disabled={!report.configured}>
              <Download className="size-4" /> PDF
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Menampilkan <span className="font-semibold text-foreground">{KIND_LABEL[kind]}</span> · <span className="font-semibold text-foreground">{PERIOD_LABEL[period]}</span> · periode{" "}
          <span className="font-semibold text-foreground">{report.label}</span>
        </p>
      </div>

      {!report.configured && (
        <div className="glass flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-amber-500" />
          <p>{report.error ?? "Integrasi belum aktif."} Data void/cancel diambil dari sistem POS/ESB — hubungi admin untuk mengaktifkan.</p>
        </div>
      )}
      {report.configured && report.error && (
        <div className="glass flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-red-500" />
          <p><span className="font-medium text-foreground">Gagal memuat {report.source === "esb" ? "data ESB" : "data POS"}:</span> {report.error}</p>
        </div>
      )}
      {report.configured && !report.error && report.warning && (
        <div className="glass flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-amber-500" />
          <p><span className="font-medium text-foreground">Data belum lengkap:</span> {report.warning}</p>
        </div>
      )}

      {report.configured && (
        <>
          {!hasData ? (
            <div className="glass flex flex-col items-center gap-2 rounded-2xl border border-border px-6 py-12 text-center">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <p className="text-base font-semibold text-foreground">Belum ada transaksi {KIND_LABEL[report.kind]} pada periode ini</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Tidak ada transaksi {KIND_LABEL[report.kind]} untuk <span className="font-medium text-foreground">{report.label}</span>. Coba pilih tanggal/periode/tipe lain yang sudah ada transaksi.
              </p>
            </div>
          ) : report.source === "esb" ? (
            <>
              <InsightStrip report={report} prevTotal={prevTotal} />
              <FraudMatrix report={report} busy={pending} query={query} mode={mode} onOpenOutlet={(outlet, day) => setDetail({ outlet, day })} />
            </>
          ) : report.perOutletReliable ? (
            <OutletTable report={report} hasAmount={hasAmount} />
          ) : (
            <div className="glass rounded-2xl border border-border p-5">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                <p className="text-sm font-medium text-foreground">Rincian per outlet belum tersedia dari API POS</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Untuk periode ini POS baru mengembalikan total gabungan semua outlet
                (<span className="font-medium text-foreground">{metricValue(hasAmount, totalCount, totalAmount)}</span>). Agar bisa dipecah per outlet,
                endpoint dashboard POS perlu mendukung parameter <code className="rounded bg-muted px-1">branchId</code>.
              </p>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Angka = total nominal (Rp, basis subtotal ESB) {KIND_LABEL[report.kind]} per outlet per hari. Klik baris outlet untuk membuka detail lengkap — siapa yang melakukan, kapan, menu apa, dan alasannya.
          </p>
        </>
      )}

      {detail && report.source === "esb" && (
        <OutletDetailModal report={report} outlet={detail.outlet} day={detail.day} pdfTheme={pdfTheme} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

const WD = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"];
function eachDay(from: string, to: string): Date[] {
  const out: Date[] = [];
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (d <= end && out.length < 40) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
const dayIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** ESB "Cancel/Void Time" → YYYY-MM-DD. The grid emits DD-MM-YYYY (sometimes
 *  with / or .), other exports use ISO — accept both so cells never go dark. */
function dayKey(s: string): string {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return "";
}

/** Per-outlet-per-day nominal map: server-computed when available. */
function useByOutlet(report: FraudReport) {
  return React.useMemo(() => {
    if (report.daily) {
      return new Map(Object.entries(report.daily).map(([name, m]) => [name, new Map(Object.entries(m))]));
    }
    const m = new Map<string, Map<string, number>>();
    for (const o of report.outlets) {
      const dm = new Map<string, number>();
      for (const ord of report.orders?.[o.name] ?? []) {
        const key = dayKey(ord.voidTime) || dayKey(ord.orderTime) || (report.from === report.to ? report.from : "");
        if (key) dm.set(key, (dm.get(key) ?? 0) + ord.total);
      }
      m.set(o.name, dm);
    }
    return m;
  }, [report]);
}

/* ------------------------------ Insight strip ------------------------------ */

/** Trend of the period (per-day totals), delta vs the previous period, and
 *  auto-generated takeaways: top outlet, worst day, top actors (server-exact). */
function InsightStrip({ report, prevTotal }: { report: FraudReport; prevTotal: number | null }) {
  const days = React.useMemo(() => eachDay(report.from, report.to), [report.from, report.to]);
  const chart = React.useMemo(() => {
    const t = new Map<string, number>();
    for (const m of Object.values(report.daily ?? {})) for (const [k, v] of Object.entries(m)) t.set(k, (t.get(k) ?? 0) + v);
    return days.map((d) => ({ key: dayIso(d), label: String(d.getDate()).padStart(2, "0"), wd: WD[d.getDay()], v: t.get(dayIso(d)) ?? 0 }));
  }, [report.daily, days]);
  const grand = report.totalVoidAmount + report.totalCancelAmount;
  const worst = chart.reduce((a, b) => (b.v > a.v ? b : a), chart[0] ?? { key: "", label: "", wd: "", v: 0 });
  const maxV = Math.max(1, ...chart.map((c) => c.v));
  const top = report.outlets[0];
  const actors = report.actors ?? [];

  const delta = prevTotal !== null && prevTotal > 0 ? ((grand - prevTotal) / prevTotal) * 100 : null;
  const deltaUp = delta !== null && delta > 1;
  const deltaDown = delta !== null && delta < -1;

  return (
    <div className="glass grid gap-4 rounded-2xl border border-border p-4 lg:grid-cols-[1fr_minmax(16rem,22rem)]">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">Tren Harian — {KIND_LABEL[report.kind]}</p>
          {delta !== null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                deltaUp && "bg-red-500/10 text-red-600 dark:text-red-400",
                deltaDown && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                !deltaUp && !deltaDown && "bg-muted text-muted-foreground",
              )}
              title={`Periode sebelumnya: ${formatIDR(prevTotal!)}`}
            >
              {deltaUp ? <ArrowUpRight className="size-3.5" /> : deltaDown ? <ArrowDownRight className="size-3.5" /> : <Minus className="size-3.5" />}
              {`${Math.abs(delta).toFixed(1).replace(".", ",")}% vs periode sebelumnya`}
            </span>
          )}
        </div>
        {chart.length > 1 ? (
          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="22%">
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" tick={{ fontSize: 10, fill: "var(--muted-foreground, #888)" }} />
                <ChartTooltip
                  cursor={{ fill: "rgba(127,127,127,0.08)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as (typeof chart)[number];
                    return (
                      <div className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs shadow-md">
                        <p className="font-medium text-foreground">{p.label} · {p.wd}</p>
                        <p className="tabular-nums text-red-600 dark:text-red-400">{formatIDR(p.v)}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="v" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {chart.map((c) => (
                    <Cell key={c.key} fill="#ef4444" fillOpacity={c.v === 0 ? 0.12 : 0.35 + 0.65 * (c.v / maxV)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-6 text-sm text-muted-foreground">Periode satu hari — pilih mingguan/bulanan untuk melihat tren.</p>
        )}
      </div>
      <div className="space-y-2 border-t border-border pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sorotan</p>
        {top && (
          <p className="text-sm">
            <span className="text-muted-foreground">Outlet tertinggi:</span>{" "}
            <span className="font-semibold text-foreground">{top.name}</span>{" "}
            <span className="tabular-nums text-red-600 dark:text-red-400">{formatIDRShort(top.voidAmount + top.cancelAmount)}</span>
            {grand > 0 && <span className="text-muted-foreground"> ({(((top.voidAmount + top.cancelAmount) / grand) * 100).toFixed(0)}%)</span>}
          </p>
        )}
        {worst && worst.v > 0 && chart.length > 1 && (
          <p className="text-sm">
            <span className="text-muted-foreground">Hari tertinggi:</span>{" "}
            <span className="font-semibold text-foreground">{worst.label} ({worst.wd})</span>{" "}
            <span className="tabular-nums text-red-600 dark:text-red-400">{formatIDRShort(worst.v)}</span>
          </p>
        )}
        {actors.length > 0 && (
          <div className="text-sm">
            <span className="text-muted-foreground">Pelaku teratas:</span>
            <div className="mt-1 space-y-0.5">
              {actors.slice(0, 3).map((a) => (
                <p key={a.name} className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium text-foreground">{a.name}</span>
                  <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{nf(a.count)} trx · <span className="text-red-600 dark:text-red-400">{formatIDRShort(a.total)}</span></span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Heat steps: ONE hue (red), light→dark by magnitude relative to the largest
 *  cell. Text stays on ink/red tokens; exact Rp rides on the title tooltip. */
function heatClass(v: number, max: number): string {
  if (v <= 0 || max <= 0) return "text-muted-foreground/30";
  const t = v / max;
  if (t <= 0.15) return "bg-red-500/10 text-red-700 dark:text-red-300";
  if (t <= 0.35) return "bg-red-500/20 text-red-700 dark:text-red-200";
  if (t <= 0.6) return "bg-red-500/30 text-red-800 dark:text-red-100";
  if (t <= 0.85) return "bg-red-500/45 text-red-950 dark:text-red-50 font-semibold";
  return "bg-red-500/60 text-red-950 dark:text-red-50 font-semibold";
}

/** Matrix: outlets (rows) × days (columns), heat by nominal. Header, footer and
 *  the outlet column stay frozen while the body scrolls in both directions. */
function FraudMatrix({ report, busy, query, mode, onOpenOutlet }: { report: FraudReport; busy?: boolean; query: string; mode: "rp" | "trx"; onOpenOutlet: (o: FraudOutletRow, day?: string) => void }) {
  const days = React.useMemo(() => eachDay(report.from, report.to), [report.from, report.to]);
  const byAmount = useByOutlet(report);
  const byCount = React.useMemo(
    () => new Map(Object.entries(report.dailyCount ?? {}).map(([name, m]) => [name, new Map(Object.entries(m))])),
    [report.dailyCount],
  );
  const trx = mode === "trx" && byCount.size > 0;
  const byOutlet = trx ? byCount : byAmount;
  const fmtCell = (v: number) => (trx ? nf(v) : formatIDRShort(v));
  const fmtFull = (v: number) => (trx ? `${nf(v)} transaksi` : formatIDR(v));
  const rowTotal = (o: FraudOutletRow) => (trx ? o.void + o.cancel : o.voidAmount + o.cancelAmount);

  // Sort: by grand total (default), by name, or by a specific day's value.
  const [sortKey, setSortKey] = React.useState<"total" | "name" | string>("total");
  const outlets = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? report.outlets.filter((o) => o.name.toLowerCase().includes(q)) : [...report.outlets];
    if (sortKey === "name") return base.sort((a, b) => a.name.localeCompare(b.name, "id"));
    if (sortKey !== "total") return base.sort((a, b) => (byOutlet.get(b.name)?.get(sortKey) ?? 0) - (byOutlet.get(a.name)?.get(sortKey) ?? 0));
    return base.sort((a, b) => rowTotal(b) - rowTotal(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report.outlets, query, sortKey, byOutlet, trx]);

  // Per-day column totals + the largest cell (heat scale reference) + anomaly
  // threshold (mean + 2σ of non-zero cells → ring highlight).
  const colTotals = React.useMemo(() => {
    const t = new Map<string, number>();
    for (const dm of byOutlet.values()) for (const [k, v] of dm) t.set(k, (t.get(k) ?? 0) + v);
    return t;
  }, [byOutlet]);
  const { maxCell, anomaly } = React.useMemo(() => {
    const vals: number[] = [];
    for (const dm of byOutlet.values()) for (const v of dm.values()) if (v > 0) vals.push(v);
    const max = vals.length ? Math.max(...vals) : 0;
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const sd = vals.length ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) : 0;
    return { maxCell: max, anomaly: vals.length >= 8 ? mean + 2 * sd : Infinity };
  }, [byOutlet]);

  const grand = trx ? report.totalVoid + report.totalCancel : report.totalVoidAmount + report.totalCancelAmount;
  const txCount = report.totalVoid + report.totalCancel;
  const maxRow = Math.max(1, ...report.outlets.map(rowTotal));
  const sortMark = (key: string) => (sortKey === key ? " ▾" : "");

  return (
    <div className={cn("glass -mx-4 overflow-hidden border-y border-border transition-opacity sm:mx-0 sm:rounded-2xl sm:border", busy && "opacity-60")}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{KIND_LABEL[report.kind]} per Outlet per Hari — {report.label}</p>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>Rendah</span>
            <span className="h-2.5 w-4 rounded-sm bg-red-500/10" />
            <span className="h-2.5 w-4 rounded-sm bg-red-500/20" />
            <span className="h-2.5 w-4 rounded-sm bg-red-500/30" />
            <span className="h-2.5 w-4 rounded-sm bg-red-500/45" />
            <span className="h-2.5 w-4 rounded-sm bg-red-500/60" />
            <span>Tinggi</span>
            <span className="ml-2 inline-block size-2.5 rounded-sm ring-2 ring-inset ring-red-600" /> <span>= anomali (&gt; rata-rata + 2σ)</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-foreground">{trx ? `${nf(grand)} transaksi` : formatIDR(grand)}</p>
          <p className="text-[11px] text-muted-foreground">
            {trx ? formatIDR(report.totalVoidAmount + report.totalCancelAmount) : `${nf(txCount)} transaksi`} · {nf(report.outlets.length)} outlet
          </p>
        </div>
      </div>
      {/* Frozen header + frozen outlet column + frozen footer; body scrolls.
          Header cells are clickable to sort (name / total / one day). */}
      <div className="max-h-[72vh] overflow-auto overscroll-contain">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th
                className="sticky left-0 top-0 z-30 cursor-pointer select-none border-b border-border bg-background px-3 py-2 text-left font-medium hover:text-foreground"
                title="Urutkan berdasarkan nama"
                onClick={() => setSortKey(sortKey === "name" ? "total" : "name")}
              >
                Outlet{sortMark("name")}
              </th>
              <th
                className="sticky top-0 z-20 cursor-pointer select-none border-b border-border bg-background px-2.5 py-2 text-right font-medium hover:text-foreground"
                title="Urutkan berdasarkan total"
                onClick={() => setSortKey("total")}
              >
                Total{sortMark("total")}
              </th>
              {days.map((d) => (
                <th
                  key={dayIso(d)}
                  className={cn(
                    "sticky top-0 z-20 cursor-pointer select-none border-b border-border bg-background px-2 py-1.5 text-center font-medium tabular-nums hover:text-foreground",
                    sortKey === dayIso(d) && "text-foreground",
                  )}
                  title="Urutkan outlet berdasarkan hari ini"
                  onClick={() => setSortKey(sortKey === dayIso(d) ? "total" : dayIso(d))}
                >
                  <div>{String(d.getDate()).padStart(2, "0")}{sortMark(dayIso(d))}</div>
                  <div className="text-[9px] text-muted-foreground/70">{WD[d.getDay()]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {outlets.map((o) => {
              const dm = byOutlet.get(o.name);
              const total = rowTotal(o);
              return (
                <tr key={o.branchId} className="cursor-pointer border-b border-border/50 transition-colors hover:bg-foreground/[0.04]" onClick={() => onOpenOutlet(o)}>
                  <td className="sticky left-0 z-10 max-w-[11rem] bg-background px-3 py-1.5 sm:max-w-[14rem]">
                    <span className="block truncate font-medium text-foreground">{o.name}</span>
                    <span className="mt-1 block h-1 w-24 max-w-full overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-red-500/70" style={{ width: `${(total / maxRow) * 100}%` }} />
                    </span>
                  </td>
                  <td title={`${formatIDR(o.voidAmount + o.cancelAmount)} · ${nf(o.void + o.cancel)} trx`} className="whitespace-nowrap px-2.5 py-1.5 text-right font-semibold tabular-nums text-foreground">
                    {fmtCell(total)}
                  </td>
                  {days.map((d) => {
                    const v = dm?.get(dayIso(d)) ?? 0;
                    return (
                      <td
                        key={dayIso(d)}
                        title={v > 0 ? `${fmtFull(v)} — klik untuk detail hari ini` : undefined}
                        onClick={v > 0 ? (e) => { e.stopPropagation(); onOpenOutlet(o, dayIso(d)); } : undefined}
                        className={cn(
                          "whitespace-nowrap px-2 py-1.5 text-center tabular-nums",
                          heatClass(v, maxCell),
                          v > anomaly && "ring-2 ring-inset ring-red-600",
                        )}
                      >
                        {v > 0 ? fmtCell(v) : "–"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {outlets.length === 0 && (
              <tr>
                <td colSpan={days.length + 2} className="px-4 py-8 text-center text-sm text-muted-foreground">Tidak ada outlet yang cocok dengan pencarian.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="font-medium text-foreground">
              <td className="sticky bottom-0 left-0 z-30 border-t border-border bg-background px-3 py-2">Total per hari</td>
              <td title={fmtFull(grand)} className="sticky bottom-0 z-20 border-t border-border bg-background px-2.5 py-2 text-right font-bold tabular-nums">{fmtCell(grand)}</td>
              {days.map((d) => {
                const v = colTotals.get(dayIso(d)) ?? 0;
                return (
                  <td key={dayIso(d)} title={v > 0 ? fmtFull(v) : undefined} className={cn("sticky bottom-0 z-20 whitespace-nowrap border-t border-border bg-background px-2 py-2 text-center tabular-nums", v > 0 ? "text-foreground" : "text-muted-foreground/30")}>
                    {v > 0 ? fmtCell(v) : "–"}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------ Detail modal ------------------------------ */

/** Big detail dialog for one outlet — built from the app's own design system
 *  (surface-solid panel, StatTile metrics, SegmentedTabs, Sheet-style header). */
function OutletDetailModal({ report, outlet, day, pdfTheme, onClose }: { report: FraudReport; outlet: FraudOutletRow; day?: string; pdfTheme: PdfTheme; onClose: () => void }) {
  const byOutlet = useByOutlet(report);
  const [tab, setTab] = React.useState<"ringkasan" | "order">(day ? "order" : "ringkasan");
  const [dayFilter, setDayFilter] = React.useState<string | undefined>(day);
  const [actorFilter, setActorFilter] = React.useState<string | undefined>(undefined);
  const [q, setQ] = React.useState("");
  const [visible, setVisible] = React.useState(60);

  const allOrders = React.useMemo(() => report.orders?.[outlet.name] ?? [], [report.orders, outlet.name]);
  const orders = React.useMemo(() => {
    let list = allOrders;
    if (dayFilter) list = list.filter((o) => (dayKey(o.voidTime) || dayKey(o.orderTime)) === dayFilter);
    if (actorFilter) list = list.filter((o) => (o.voidBy || "(tidak tercatat)") === actorFilter);
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((o) => [o.menu, o.voidBy, o.orderBy, o.salesNumber, o.notes].some((f) => f.toLowerCase().includes(s)));
    return [...list].sort((a, b) => b.total - a.total); // largest first — pagination pages by size
  }, [allOrders, dayFilter, actorFilter, q]);
  React.useEffect(() => setVisible(60), [dayFilter, actorFilter, q]);
  const filtered = Boolean(dayFilter || actorFilter || q.trim());
  const filteredSum = React.useMemo(() => orders.reduce((a, o) => a + o.total, 0), [orders]);

  const total = outlet.voidAmount + outlet.cancelAmount;
  const txCount = outlet.void + outlet.cancel;
  const capped = txCount > allOrders.length;
  const dayLabel = (iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()].slice(0, 3)}`;
  };

  const dailyRows = React.useMemo(() => {
    const dm = byOutlet.get(outlet.name) ?? new Map<string, number>();
    return eachDay(report.from, report.to)
      .map((d) => ({ iso: dayIso(d), label: `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()].slice(0, 3)}`, wd: WD[d.getDay()], v: dm.get(dayIso(d)) ?? 0 }))
      .filter((x) => x.v > 0);
  }, [byOutlet, outlet.name, report.from, report.to]);
  const maxDaily = Math.max(1, ...dailyRows.map((x) => x.v));

  const actors = React.useMemo(() => {
    const byActor = new Map<string, { count: number; total: number }>();
    for (const o of allOrders) {
      const who = o.voidBy || "(tidak tercatat)";
      const a = byActor.get(who) ?? { count: 0, total: 0 };
      a.count += 1;
      a.total += o.total;
      byActor.set(who, a);
    }
    return [...byActor.entries()].sort((x, y) => y[1].total - x[1].total);
  }, [allOrders]);
  const maxActor = Math.max(1, ...actors.map(([, a]) => a.total));

  // Lock page scroll while open; Esc closes.
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const openActor = (name: string) => {
    setActorFilter(actorFilter === name ? undefined : name);
    setTab("order");
  };

  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="animate-overlay-in absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-pop-in surface-solid relative flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-h-[88vh] sm:max-w-5xl sm:rounded-2xl">
        {/* Sheet-style header */}
        <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted ring-1 ring-border">
              <Store className="size-5 text-foreground/70" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-snug text-foreground">{outlet.name}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{KIND_LABEL[report.kind]} · {report.label}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadPdf(report, pdfTheme, outlet)}>
              <Download className="size-4" /> <span className="hidden sm:inline">PDF Outlet</span><span className="sm:hidden">PDF</span>
            </Button>
            <button
              onClick={onClose}
              aria-label="Tutup"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* KPI tiles — the app's dashboard StatTile */}
          <div className="grid grid-cols-2 gap-2.5 p-4 sm:p-5 sm:pb-3 lg:grid-cols-4">
            <StatTile icon={Wallet} label="Total Nominal" value={formatIDRShort(total)} sub={formatIDR(total)} />
            <StatTile icon={ReceiptText} label="Transaksi" value={nf(txCount)} sub={`${nf(dailyRows.length)} hari aktif`} />
            <StatTile icon={Users} label="Pelaku Terlibat" value={nf(actors.length)} sub={actors[0] ? `Teratas: ${actors[0][0]}` : undefined} />
            <StatTile icon={CalendarDays} label="Rata-rata / Hari" value={formatIDRShort(total / Math.max(1, dailyRows.length))} sub="pada hari aktif" />
          </div>

          <div className="px-4 sm:px-5">
            <SegmentedTabs
              size="sm"
              className="w-full sm:w-80"
              items={[{ value: "ringkasan", label: "Ringkasan" }, { value: "order", label: `Order (${nf(filtered ? orders.length : allOrders.length)})` }]}
              value={tab}
              onChange={(v) => setTab(v as "ringkasan" | "order")}
            />
          </div>

          {tab === "ringkasan" ? (
            <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-2">
              {/* Per-day panel */}
              <div className="rounded-2xl border border-border bg-card/50">
                <div className="border-b border-border px-4 py-2.5">
                  <p className="text-sm font-semibold text-foreground">Per Hari</p>
                  <p className="text-[11px] text-muted-foreground">Klik tanggal untuk melihat order hari itu.</p>
                </div>
                <div className="max-h-72 space-y-0.5 overflow-y-auto p-2.5">
                  {dailyRows.map((x) => (
                    <button
                      type="button"
                      key={x.iso}
                      onClick={() => { setDayFilter(x.iso); setTab("order"); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left text-xs transition-colors hover:bg-foreground/[0.05]"
                    >
                      <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{x.label} <span className="text-muted-foreground/50">{x.wd}</span></span>
                      <span className="block h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-red-500/70" style={{ width: `${(x.v / maxDaily) * 100}%` }} />
                      </span>
                      <span className="w-24 shrink-0 text-right tabular-nums text-foreground">{formatIDR(x.v)}</span>
                    </button>
                  ))}
                  {dailyRows.length === 0 && <p className="px-1.5 py-3 text-xs text-muted-foreground">Tidak ada transaksi.</p>}
                </div>
              </div>
              {/* Actors panel */}
              <div className="rounded-2xl border border-border bg-card/50">
                <div className="border-b border-border px-4 py-2.5">
                  <p className="text-sm font-semibold text-foreground">Pelaku (Oleh)</p>
                  <p className="text-[11px] text-muted-foreground">Klik nama untuk mengaudit order orang itu.</p>
                </div>
                <div className="max-h-72 space-y-0.5 overflow-y-auto p-2.5">
                  {actors.map(([who, a], i) => (
                    <button
                      type="button"
                      key={who}
                      onClick={() => openActor(who)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left text-xs transition-colors hover:bg-foreground/[0.05]"
                    >
                      <span className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-md text-[10px] font-bold tabular-nums",
                        i === 0 ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-muted text-muted-foreground",
                      )}>{i + 1}</span>
                      <span className="w-32 shrink-0 truncate font-medium text-foreground" title={who}>{who}</span>
                      <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-red-500/70" style={{ width: `${(a.total / maxActor) * 100}%` }} />
                      </span>
                      <span className="shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">{nf(a.count)} · <span className="text-foreground">{formatIDRShort(a.total)}</span></span>
                    </button>
                  ))}
                  {actors.length === 0 && <p className="px-1.5 py-3 text-xs text-muted-foreground">Tidak ada data pelaku.</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                {dayFilter && (
                  <button
                    type="button"
                    onClick={() => setDayFilter(undefined)}
                    className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
                  >
                    <CalendarDays className="size-3" /> {dayLabel(dayFilter)} <X className="size-3" />
                  </button>
                )}
                {actorFilter && (
                  <button
                    type="button"
                    onClick={() => setActorFilter(undefined)}
                    className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-400"
                  >
                    <Users className="size-3" /> {actorFilter} <X className="size-3" />
                  </button>
                )}
                {filtered && (
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    Σ <span className="font-semibold text-foreground">{formatIDR(filteredSum)}</span> · {nf(orders.length)} order
                  </span>
                )}
                {!filtered && capped && (
                  <span className="text-[11px] text-muted-foreground">Menampilkan {nf(allOrders.length)} order terbesar dari {nf(txCount)} transaksi.</span>
                )}
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari menu / pelaku / no. bill / alasan…"
                  className="ml-auto h-9 w-full rounded-xl border border-border bg-background px-3 text-xs outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring sm:w-72"
                />
              </div>
              <OrdersTable orders={orders.slice(0, visible)} />
              {orders.length > visible && (
                <div className="flex justify-center pt-1">
                  <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + 60)}>
                    Muat lebih banyak ({nf(orders.length - visible)} lagi)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** ESB order-level rows for one outlet. */
function OrdersTable({ orders }: { orders: FraudOrder[] }) {
  if (orders.length === 0) return <p className="py-2 text-xs text-muted-foreground">Tidak ada order pada periode ini.</p>;
  const sorted = [...orders].sort((a, b) => b.total - a.total);
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[52rem] text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-2.5 py-2">No. Bill</th>
            <th className="px-2.5 py-2">Menu</th>
            <th className="px-2.5 py-2">Order By</th>
            <th className="px-2.5 py-2">Oleh</th>
            <th className="px-2.5 py-2">Waktu</th>
            <th className="px-2.5 py-2 text-center">Tipe</th>
            <th className="px-2.5 py-2">Alasan</th>
            <th className="px-2.5 py-2 text-right">Qty</th>
            <th className="px-2.5 py-2 text-right">Nominal</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((o, i) => (
            <tr key={`${o.salesNumber}-${i}`} className="border-b border-border/50 last:border-0">
              <td className="px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">{o.salesNumber}</td>
              <td className="px-2.5 py-1.5 text-foreground">{o.menu}</td>
              <td className="px-2.5 py-1.5">{o.orderBy}</td>
              <td className="px-2.5 py-1.5 font-medium text-foreground">{o.voidBy}</td>
              <td className="whitespace-nowrap px-2.5 py-1.5 text-muted-foreground">{o.voidTime || o.orderTime}</td>
              <td className="px-2.5 py-1.5 text-center">
                <Badge tone={/void|delete/i.test(o.type) ? "danger" : "warning"}>{o.type || "Delete"}</Badge>
              </td>
              <td className="max-w-[16rem] truncate px-2.5 py-1.5 text-muted-foreground" title={o.notes}>{o.notes || "—"}</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums">{nf(o.qty)}</td>
              <td className="px-2.5 py-1.5 text-right tabular-nums text-foreground">{formatIDR(o.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------- POS fallback table --------------------------- */

function OutletTable({ report, hasAmount }: { report: FraudReport; hasAmount: boolean }) {
  const [openId, setOpenId] = React.useState<number | null>(null);
  const score = (o: { void: number; cancel: number; voidAmount: number; cancelAmount: number }) =>
    hasAmount ? o.voidAmount + o.cancelAmount : o.void + o.cancel;
  const max = Math.max(1, ...report.outlets.map(score));

  return (
    <div className="glass overflow-hidden rounded-2xl border border-border">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">Void &amp; Cancel per Outlet — {report.label}</p>
        <p className="text-xs text-muted-foreground">Diurutkan dari {hasAmount ? "nominal" : "kejadian"} terbanyak. Klik baris untuk lihat rincian per hari.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="whitespace-nowrap border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5">#</th>
              <th className="px-4 py-2.5">Outlet</th>
              <th className="px-4 py-2.5 text-right">Void</th>
              <th className="px-4 py-2.5 text-right">Cancel</th>
              <th className="px-4 py-2.5 text-right">Total</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {report.outlets.map((o, i) => {
              const total = hasAmount ? o.voidAmount + o.cancelAmount : o.void + o.cancel;
              const open = openId === o.branchId;
              return (
                <React.Fragment key={o.branchId}>
                  <tr
                    className={cn("cursor-pointer border-b border-border/60 transition-colors hover:bg-foreground/[0.04]", i === 0 && "bg-red-500/[0.04]")}
                    onClick={() => setOpenId(open ? null : o.branchId)}
                  >
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{o.name}</span>
                        {i === 0 && total > 0 && <Badge tone="danger">Tertinggi</Badge>}
                      </div>
                      <div className="mt-1 h-1.5 w-40 max-w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-red-500/70" style={{ width: `${(total / max) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {metricValue(hasAmount, o.void, o.voidAmount)}
                      {hasAmount && <span className="block text-[10px] text-muted-foreground">{nf(o.void)} trx</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {metricValue(hasAmount, o.cancel, o.cancelAmount)}
                      {hasAmount && <span className="block text-[10px] text-muted-foreground">{nf(o.cancel)} trx</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{metricValue(hasAmount, o.void + o.cancel, total)}</td>
                    <td className="px-4 py-3 text-right">
                      <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-border/60 bg-muted/20">
                      <td colSpan={6} className="px-4 py-3">
                        <OutletDetail branchId={o.branchId} from={report.from} to={report.to} hasAmount={hasAmount} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OutletDetail({ branchId, from, to, hasAmount }: { branchId: number; from: string; to: string; hasAmount: boolean }) {
  const [days, setDays] = React.useState<FraudDailyPoint[] | null>(null);
  React.useEffect(() => {
    let live = true;
    outletFraudDailyAction(branchId, from, to).then((res) => {
      if (live && Array.isArray(res)) setDays(res);
    });
    return () => {
      live = false;
    };
  }, [branchId, from, to]);

  if (!days) {
    return (
      <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Memuat rincian harian dari POS…
      </p>
    );
  }
  const val = (d: FraudDailyPoint) => (hasAmount ? d.voidAmount + d.cancelAmount : d.void + d.cancel);
  const active = days.filter((d) => d.void + d.cancel + d.voidAmount + d.cancelAmount > 0);
  if (active.length === 0) return <p className="py-2 text-xs text-muted-foreground">Tidak ada void/cancel pada rentang ini.</p>;
  const max = Math.max(1, ...days.map(val));
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">Rincian per hari</p>
      <div className="space-y-1">
        {active.map((d) => (
          <div key={d.date} className="flex items-center gap-3 text-xs">
            <span className="w-14 shrink-0 tabular-nums text-muted-foreground">{d.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-red-500/70" style={{ width: `${(val(d) / max) * 100}%` }} />
            </div>
            <span className="w-40 shrink-0 text-right tabular-nums">
              <span className="text-foreground">V {metricValue(hasAmount, d.void, d.voidAmount)}</span>
              <span className="text-muted-foreground"> · C {metricValue(hasAmount, d.cancel, d.cancelAmount)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Exports (CSV/PDF) ------------------------------ */

/** Matrix CSV (outlet × day + totals) — matches the on-screen numbers exactly,
 *  so it can be reconciled against ESB recaps in Excel. */
function downloadCsv(report: FraudReport) {
  const days = eachDay(report.from, report.to);
  const daily = report.daily ?? {};
  const head = ["Outlet", ...days.map((d) => dayIso(d)), "Total"];
  const lines = [head.join(";")];
  const colTot = new Map<string, number>();
  for (const o of report.outlets) {
    const dm = daily[o.name] ?? {};
    const cells = days.map((d) => {
      const v = dm[dayIso(d)] ?? 0;
      colTot.set(dayIso(d), (colTot.get(dayIso(d)) ?? 0) + v);
      return String(Math.round(v));
    });
    lines.push([`"${o.name.replace(/"/g, '""')}"`, ...cells, String(Math.round(o.voidAmount + o.cancelAmount))].join(";"));
  }
  lines.push(["TOTAL", ...days.map((d) => String(Math.round(colTot.get(dayIso(d)) ?? 0))), String(Math.round(report.totalVoidAmount + report.totalCancelAmount))].join(";"));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `fraud-${report.kind}-${report.from}-sd-${report.to}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** Themed, branded print report (Save as PDF). Scope: all outlets, or one
 *  outlet (daily breakdown + top actors + order detail). */
function downloadPdf(report: FraudReport, theme: PdfTheme, outlet?: FraudOutletRow) {
  const w = window.open("", "_blank", "width=980,height=1200");
  if (!w) {
    toast.error("Popup diblokir. Izinkan popup untuk mengunduh PDF.");
    return;
  }
  const dark = theme === "dark";
  const C = dark
    ? { bg: "#0b0f1a", card: "#121a2b", line: "#26314d", ink: "#e8edf7", mut: "#93a0b8", accent: "#f87171", chip: "#1a2338", logoBg: "#ffffff" }
    : { bg: "#ffffff", card: "#f7f8fb", line: "#e5e8ef", ink: "#141824", mut: "#69738a", accent: "#dc2626", chip: "#eef1f6", logoBg: "#eef1f6" };
  const generated = new Date().toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const logo = `${window.location.origin}/gwg.svg`;
  const grand = report.totalVoidAmount + report.totalCancelAmount;
  const txAll = report.totalVoid + report.totalCancel;

  const days = eachDay(report.from, report.to);
  const daily = report.daily ?? {};

  let body = "";
  if (!outlet) {
    // ALL outlets: ranking table + per-day totals
    const rows = report.outlets
      .map((o, i) => {
        const t = o.voidAmount + o.cancelAmount;
        const pct = grand > 0 ? ((t / grand) * 100).toFixed(1).replace(".", ",") : "0";
        return `<tr${i === 0 ? ' class="top"' : ""}><td>${i + 1}</td><td>${esc(o.name)}</td><td class="n">${nf(o.void + o.cancel)}</td><td class="n b">${formatIDR(t)}</td><td class="n">${pct}%</td></tr>`;
      })
      .join("");
    const colTot = new Map<string, number>();
    for (const m of Object.values(daily)) for (const [k, v] of Object.entries(m)) colTot.set(k, (colTot.get(k) ?? 0) + v);
    const dayRows = days
      .map((d) => ({ d, v: colTot.get(dayIso(d)) ?? 0 }))
      .filter((x) => x.v > 0)
      .map((x) => `<tr><td>${String(x.d.getDate()).padStart(2, "0")} ${MONTHS[x.d.getMonth()].slice(0, 3)} · ${WD[x.d.getDay()]}</td><td class="n b">${formatIDR(x.v)}</td></tr>`)
      .join("");
    body = `
      <h2>Peringkat Outlet</h2>
      <table><thead><tr><th>#</th><th>Outlet</th><th class="n">Trx</th><th class="n">Total</th><th class="n">% Kontribusi</th></tr></thead><tbody>${rows}</tbody></table>
      ${dayRows ? `<h2>Total per Hari</h2><table class="half"><thead><tr><th>Tanggal</th><th class="n">Total</th></tr></thead><tbody>${dayRows}</tbody></table>` : ""}`;
  } else {
    // ONE outlet: daily breakdown + actors + order detail
    const orders = report.orders?.[outlet.name] ?? [];
    const dm = daily[outlet.name] ?? {};
    const dayRows = days
      .map((d) => ({ d, v: dm[dayIso(d)] ?? 0 }))
      .filter((x) => x.v > 0)
      .map((x) => `<tr><td>${String(x.d.getDate()).padStart(2, "0")} ${MONTHS[x.d.getMonth()].slice(0, 3)} · ${WD[x.d.getDay()]}</td><td class="n b">${formatIDR(x.v)}</td></tr>`)
      .join("");
    const byActor = new Map<string, { count: number; total: number }>();
    for (const o of orders) {
      const who = o.voidBy || "(tidak tercatat)";
      const a = byActor.get(who) ?? { count: 0, total: 0 };
      a.count += 1;
      a.total += o.total;
      byActor.set(who, a);
    }
    const actorRows = [...byActor.entries()]
      .sort((x, y) => y[1].total - x[1].total)
      .slice(0, 8)
      .map(([who, a]) => `<tr><td>${esc(who)}</td><td class="n">${nf(a.count)}</td><td class="n b">${formatIDR(a.total)}</td></tr>`)
      .join("");
    const orderRows = [...orders]
      .sort((a, b) => b.total - a.total)
      .map((o) => `<tr><td class="mono">${esc(o.salesNumber)}</td><td>${esc(o.menu)}</td><td>${esc(o.voidBy)}</td><td>${esc(o.voidTime || o.orderTime)}</td><td>${esc(o.type || "Delete")}</td><td>${esc(o.notes || "—")}</td><td class="n">${nf(o.qty)}</td><td class="n b">${formatIDR(o.total)}</td></tr>`)
      .join("");
    const cappedNote = outlet.void + outlet.cancel > orders.length ? `<p class="note">Menampilkan ${nf(orders.length)} order terbesar dari total ${nf(outlet.void + outlet.cancel)} transaksi.</p>` : "";
    body = `
      ${dayRows ? `<h2>Per Hari</h2><table class="half"><thead><tr><th>Tanggal</th><th class="n">Total</th></tr></thead><tbody>${dayRows}</tbody></table>` : ""}
      ${actorRows ? `<h2>Pelaku (Oleh)</h2><table class="half"><thead><tr><th>Nama</th><th class="n">Trx</th><th class="n">Total</th></tr></thead><tbody>${actorRows}</tbody></table>` : ""}
      <h2>Detail Order</h2>${cappedNote}
      <table class="small"><thead><tr><th>No. Bill</th><th>Menu</th><th>Oleh</th><th>Waktu</th><th>Tipe</th><th>Alasan</th><th class="n">Qty</th><th class="n">Nominal</th></tr></thead><tbody>${orderRows}</tbody></table>`;
  }

  const scopeTitle = outlet ? esc(outlet.name) : "Semua Outlet";
  const scopeTotal = outlet ? outlet.voidAmount + outlet.cancelAmount : grand;
  const scopeTx = outlet ? outlet.void + outlet.cancel : txAll;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Laporan Fraud — ${scopeTitle} — ${esc(report.label)}</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; background: ${C.bg}; color: ${C.ink}; margin: 0; font-size: 12.5px; }
    .page { padding: 28px 32px; }
    .head { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid ${C.line}; padding-bottom: 14px; margin-bottom: 16px; }
    .logo { width: 52px; height: 52px; border-radius: 12px; background: ${C.logoBg}; display: grid; place-items: center; }
    .logo img { width: 38px; height: 38px; object-fit: contain; }
    h1 { font-size: 18px; margin: 0; } .sub { color: ${C.mut}; margin: 2px 0 0; font-size: 12px; }
    .chips { display: flex; gap: 10px; margin: 14px 0 18px; flex-wrap: wrap; }
    .chip { background: ${C.chip}; border: 1px solid ${C.line}; border-radius: 10px; padding: 10px 14px; min-width: 150px; }
    .chip .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: ${C.mut}; }
    .chip .val { font-size: 17px; font-weight: 700; margin-top: 3px; }
    .chip .val.accent { color: ${C.accent}; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: ${C.mut}; margin: 20px 0 8px; }
    table { width: 100%; border-collapse: collapse; background: ${C.card}; border: 1px solid ${C.line}; border-radius: 10px; overflow: hidden; }
    table.half { width: 60%; } table.small { font-size: 11px; }
    th, td { padding: 7px 10px; border-bottom: 1px solid ${C.line}; text-align: left; }
    thead th { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; color: ${C.mut}; background: ${C.chip}; }
    tbody tr:last-child td { border-bottom: none; }
    td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; } td.b { font-weight: 700; }
    td.mono { font-family: ui-monospace, Menlo, monospace; font-size: 10.5px; color: ${C.mut}; }
    tr.top td { background: ${dark ? "rgba(248,113,113,.12)" : "#fdecec"}; }
    .note { color: ${C.mut}; font-size: 11px; margin: 4px 0 8px; }
    .foot { margin-top: 22px; color: ${C.mut}; font-size: 10.5px; border-top: 1px solid ${C.line}; padding-top: 10px; display: flex; justify-content: space-between; gap: 12px; }
    @media print { .page { padding: 10mm 12mm; } table.half { width: 70%; } }
  </style></head><body>
    <div class="page">
      <div class="head">
        <div class="logo"><img src="${logo}" alt="GWG"></div>
        <div>
          <h1>Laporan Analisis Fraud — ${esc(KIND_LABEL[report.kind])}</h1>
          <p class="sub">GWG Group · ${scopeTitle} · Periode ${PERIOD_LABEL[report.period]}: <b>${esc(report.label)}</b> · Dibuat ${esc(generated)}</p>
        </div>
      </div>
      <div class="chips">
        <div class="chip"><div class="lbl">Total Nominal</div><div class="val accent">${formatIDR(scopeTotal)}</div></div>
        <div class="chip"><div class="lbl">Transaksi</div><div class="val">${nf(scopeTx)}</div></div>
        ${outlet ? "" : `<div class="chip"><div class="lbl">Outlet Terdampak</div><div class="val">${nf(report.outlets.length)}</div></div>`}
        <div class="chip"><div class="lbl">Basis Angka</div><div class="val" style="font-size:13px">Subtotal (ESB)</div></div>
      </div>
      ${body}
      <div class="foot">
        <span>Sumber: ESB — angka berbasis subtotal, identik dengan recap ESB. Lonjakan pada satu outlet/pelaku menandakan potensi fraud.</span>
        <span>Dibuat otomatis oleh Operation GWG</span>
      </div>
    </div>
  </body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 450);
}
