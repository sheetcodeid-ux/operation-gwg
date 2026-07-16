"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { cn, formatIDR, formatIDRShort } from "@/lib/utils";
import { fraudReportAction, fraudSyncAction, outletFraudDailyAction } from "@/lib/actions/fraud";
import type { FraudDailyPoint, FraudKind, FraudOrder, FraudPeriod, FraudReport } from "@/lib/data/fraud";

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

/** Value shown per metric: Rp nominal when the POS returns it, else the count. */
const metricValue = (hasAmount: boolean, count: number, amount: number) => (hasAmount ? formatIDR(amount) : nf(count));

export function FraudAnalysis({ initial, initialDate }: { initial: FraudReport; initialDate: string }) {
  const [period, setPeriod] = React.useState<FraudPeriod>(initial.period);
  const [date, setDate] = React.useState(initialDate);
  const [kind, setKind] = React.useState<FraudKind>(initial.kind ?? "all");
  const [report, setReport] = React.useState<FraudReport>(initial);
  const [pending, start] = React.useTransition();
  // Background ESB→DB sync: days left to pull for the current selection. The
  // seq guard cancels a running drain the moment the user changes selection.
  const [syncLeft, setSyncLeft] = React.useState(0);
  const seqRef = React.useRef(0);

  const refresh = React.useCallback(async (p: FraudPeriod, d: string, k: FraudKind, seq: number) => {
    const res = await fraudReportAction(p, d, k);
    if (seqRef.current !== seq) return;
    if ("configured" in res) setReport(res);
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
      if (seqRef.current === seq) setSyncLeft(0);
    },
    [refresh],
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
    });
  }, [drainSync]);

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
    load(p, d, kind);
  };
  const onDate = (d: string) => {
    setDate(d);
    load(period, d, kind);
  };
  const onKind = (k: FraudKind) => {
    setKind(k);
    load(period, date, k);
  };

  const hasAmount = report.hasAmount;
  const totalCount = report.totalVoid + report.totalCancel;
  const totalAmount = report.totalVoidAmount + report.totalCancelAmount;
  const hasData = totalCount + totalAmount > 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="glass rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Periode</p>
            <div className="inline-flex rounded-xl border border-border bg-muted/50 p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => onPeriod(p.key)}
                  className={cn(
                    "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                    period === p.key ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{period === "daily" ? "Tanggal" : period === "weekly" ? "Minggu" : "Bulan"}</p>
            <Combobox matchTriggerWidth searchable={false} value={date} onChange={onDate} options={options} className="w-52" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tipe</p>
            <Combobox matchTriggerWidth searchable={false} value={kind} onChange={(v) => onKind(v as FraudKind)} options={KIND_OPTIONS} className="w-44" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            {syncLeft > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Loader2 className="size-3 animate-spin" /> Sinkron ESB · sisa {syncLeft} hari
              </span>
            )}
            {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <Button variant="outline" size="sm" onClick={() => downloadPdf(report)} disabled={!report.configured}>
              <Download className="size-4" /> Download PDF
            </Button>
          </div>
        </div>
        <p className="mt-3 text-sm">
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
            <FraudMatrix report={report} />
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
            Angka = total nominal (Rp) {KIND_LABEL[report.kind]} per outlet per hari (dari ESB). Klik baris outlet untuk melihat detail order (no. bill, menu, kasir, jam, alasan) — kolom &ldquo;Oleh&rdquo; menunjukkan siapa yang melakukan void/cancel/delete.
          </p>
        </>
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

/** Matrix: outlets (rows) × days (columns), cell = Rp void/cancel that day.
 *  Rows are clickable to reveal the per-order detail (ESB). */
function FraudMatrix({ report }: { report: FraudReport }) {
  const [openId, setOpenId] = React.useState<number | null>(null);
  const days = React.useMemo(() => eachDay(report.from, report.to), [report.from, report.to]);
  const byOutlet = React.useMemo(() => {
    // Server-side per-day aggregation covers ALL rows (orders may be capped);
    // deriving from orders is only a fallback for older payloads.
    if (report.daily) {
      return new Map(Object.entries(report.daily).map(([name, m]) => [name, new Map(Object.entries(m))]));
    }
    const m = new Map<string, Map<string, number>>();
    for (const o of report.outlets) {
      const dm = new Map<string, number>();
      for (const ord of report.orders?.[o.name] ?? []) {
        // Prefer the void/cancel timestamp; fall back to the order time, then to
        // the period start (single-day periods) so no nominal ever vanishes.
        const key = dayKey(ord.voidTime) || dayKey(ord.orderTime) || (report.from === report.to ? report.from : "");
        if (key) dm.set(key, (dm.get(key) ?? 0) + ord.total);
      }
      m.set(o.name, dm);
    }
    return m;
  }, [report.daily, report.outlets, report.orders, report.from, report.to]);

  return (
    <div className="glass overflow-hidden rounded-2xl border border-border">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">{KIND_LABEL[report.kind]} per Outlet per Hari — {report.label}</p>
        <p className="text-xs text-muted-foreground">Nominal (Rp) {KIND_LABEL[report.kind]} tiap outlet per tanggal. Sel merah = ada transaksi. Klik outlet untuk detail order.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-medium">Outlet</th>
              <th className="bg-background px-3 py-2 text-right font-medium">Total</th>
              {days.map((d) => (
                <th key={dayIso(d)} className="px-2 py-2 text-center font-medium tabular-nums">
                  <div>{String(d.getDate()).padStart(2, "0")}</div>
                  <div className="text-[9px] text-muted-foreground/70">{WD[d.getDay()]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.outlets.map((o) => {
              const dm = byOutlet.get(o.name);
              const total = o.voidAmount + o.cancelAmount;
              const open = openId === o.branchId;
              return (
                <React.Fragment key={o.branchId}>
                  <tr className="cursor-pointer border-b border-border/50 hover:bg-foreground/[0.04]" onClick={() => setOpenId(open ? null : o.branchId)}>
                    <td className="sticky left-0 z-10 max-w-[13rem] truncate bg-background px-3 py-2 font-medium text-foreground">{o.name}</td>
                    <td title={formatIDR(total)} className="bg-background px-3 py-2 text-right font-semibold tabular-nums text-foreground">{formatIDRShort(total)}</td>
                    {days.map((d) => {
                      const v = dm?.get(dayIso(d)) ?? 0;
                      return (
                        <td
                          key={dayIso(d)}
                          title={v > 0 ? formatIDR(v) : undefined}
                          className={cn("whitespace-nowrap px-2 py-2 text-center tabular-nums", v > 0 ? "bg-red-500/10 font-medium text-red-600 dark:text-red-400" : "text-muted-foreground/40")}
                        >
                          {v > 0 ? formatIDRShort(v) : "–"}
                        </td>
                      );
                    })}
                  </tr>
                  {open && (
                    <tr className="border-b border-border/50 bg-muted/20">
                      <td colSpan={days.length + 2} className="px-4 py-3">
                        <EsbOrderDetail orders={report.orders?.[o.name] ?? []} totalCount={o.void + o.cancel} />
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
                        {report.source === "esb" ? (
                          <EsbOrderDetail orders={report.orders?.[o.name] ?? []} totalCount={o.void + o.cancel} />
                        ) : (
                          <OutletDetail branchId={o.branchId} from={report.from} to={report.to} hasAmount={hasAmount} />
                        )}
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

/** ESB order-level detail for one outlet — each void/cancel line item. */
function EsbOrderDetail({ orders, totalCount }: { orders: FraudOrder[]; totalCount?: number }) {
  if (orders.length === 0) return <p className="py-2 text-xs text-muted-foreground">Tidak ada order void/cancel.</p>;
  const sorted = [...orders].sort((a, b) => b.total - a.total);
  const capped = totalCount !== undefined && totalCount > orders.length;
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Detail order ({capped ? `${nf(orders.length)} terbesar dari ${nf(totalCount)}` : nf(orders.length)})
      </p>
      <table className="w-full min-w-[52rem] text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="px-2 py-1.5">No. Bill</th>
            <th className="px-2 py-1.5">Menu</th>
            <th className="px-2 py-1.5">Order By</th>
            <th className="px-2 py-1.5">Oleh</th>
            <th className="px-2 py-1.5">Waktu</th>
            <th className="px-2 py-1.5 text-center">Tipe</th>
            <th className="px-2 py-1.5">Alasan</th>
            <th className="px-2 py-1.5 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((o, i) => (
            <tr key={`${o.salesNumber}-${i}`} className="border-b border-border/50">
              <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">{o.salesNumber}</td>
              <td className="px-2 py-1.5 text-foreground">{o.menu}</td>
              <td className="px-2 py-1.5">{o.orderBy}</td>
              <td className="px-2 py-1.5">{o.voidBy}</td>
              <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{o.voidTime}</td>
              <td className="px-2 py-1.5 text-center">
                <Badge tone={/void|delete/i.test(o.type) ? "danger" : "warning"}>{o.type || "Delete"}</Badge>
              </td>
              <td className="px-2 py-1.5 max-w-[16rem] truncate text-muted-foreground" title={o.notes}>{o.notes || "—"}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-foreground">{formatIDR(o.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Build a clean, self-contained printable report and open the browser print
 *  dialog (Save as PDF). No external libraries needed. */
function downloadPdf(report: FraudReport) {
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) {
    toast.error("Popup diblokir. Izinkan popup untuk mengunduh PDF.");
    return;
  }
  const hasAmount = report.hasAmount;
  const cell = (count: number, amount: number) => (hasAmount ? formatIDR(amount) : nf(count));
  const generated = new Date().toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const totalMain = cell(report.totalVoid + report.totalCancel, report.totalVoidAmount + report.totalCancelAmount);
  const rows = report.perOutletReliable && report.outlets.length
    ? report.outlets
        .map(
          (o, i) => `<tr${i === 0 ? ' class="top"' : ""}><td>${i + 1}</td><td>${esc(o.name)}</td><td class="n">${cell(o.void, o.voidAmount)}</td><td class="n">${cell(o.cancel, o.cancelAmount)}</td><td class="n b">${cell(o.void + o.cancel, o.voidAmount + o.cancelAmount)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="muted">Rincian per outlet belum tersedia dari API POS. Total gabungan: ${totalMain}.</td></tr>`;
  const unit = hasAmount ? "(nilai Rp)" : "(jumlah transaksi)";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Laporan Fraud ${esc(report.label)}</title>
  <style>
    *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;margin:32px;font-size:13px}
    h1{font-size:20px;margin:0 0 2px} .sub{color:#666;margin:0 0 18px}
    .row{display:flex;gap:12px;margin-bottom:18px}
    .card{flex:1;border:1px solid #e5e5e5;border-radius:10px;padding:12px}
    .card .lbl{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.04em} .card .val{font-size:20px;font-weight:700;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:6px} th,td{padding:8px 10px;border-bottom:1px solid #eee;text-align:left}
    th{font-size:11px;text-transform:uppercase;color:#666;letter-spacing:.04em} td.n{text-align:right;font-variant-numeric:tabular-nums} td.b{font-weight:700}
    tr.top td{background:#fdecec} td.muted{color:#666;text-align:center;padding:20px}
    .foot{margin-top:24px;color:#888;font-size:11px;border-top:1px solid #eee;padding-top:10px}
    @media print{body{margin:12mm}}
  </style></head><body>
    <h1>Laporan Analisis Fraud — Void &amp; Cancel</h1>
    <p class="sub">GWG Group · Periode ${PERIOD_LABEL[report.period]}: <b>${esc(report.label)}</b> · Tipe: <b>${KIND_LABEL[report.kind]}</b> · Angka ${unit} · Dibuat ${esc(generated)}</p>
    <div class="row">
      <div class="card"><div class="lbl">Total ${hasAmount ? "Nominal" : "Kejadian"}</div><div class="val">${totalMain}</div></div>
      <div class="card"><div class="lbl">Void</div><div class="val">${cell(report.totalVoid, report.totalVoidAmount)}</div></div>
      <div class="card"><div class="lbl">Cancel</div><div class="val">${cell(report.totalCancel, report.totalCancelAmount)}</div></div>
    </div>
    <table><thead><tr><th>#</th><th>Outlet</th><th style="text-align:right">Void</th><th style="text-align:right">Cancel</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p class="foot">Void/cancel diambil dari sistem POS. Lonjakan pada satu outlet menandakan potensi fraud dan perlu ditindaklanjuti. Dokumen dibuat otomatis oleh Operation GWG.</p>
  </body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
