"use client";

import * as React from "react";
import { AlertTriangle, ChevronDown, Download, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat";
import { cn } from "@/lib/utils";
import { fraudReportAction, outletFraudDailyAction } from "@/lib/actions/fraud";
import type { FraudDailyPoint, FraudPeriod, FraudReport } from "@/lib/data/fraud";

const PERIODS: { key: FraudPeriod; label: string }[] = [
  { key: "daily", label: "Harian" },
  { key: "weekly", label: "Mingguan" },
  { key: "monthly", label: "Bulanan" },
];
const PERIOD_LABEL: Record<FraudPeriod, string> = { daily: "Harian", weekly: "Mingguan", monthly: "Bulanan" };
const nf = (n: number) => n.toLocaleString("id-ID");

export function FraudAnalysis({ initial, initialDate }: { initial: FraudReport; initialDate: string }) {
  const [period, setPeriod] = React.useState<FraudPeriod>(initial.period);
  const [date, setDate] = React.useState(initialDate);
  const [report, setReport] = React.useState<FraudReport>(initial);
  const [pending, start] = React.useTransition();

  const load = React.useCallback((p: FraudPeriod, d: string) => {
    start(async () => {
      const res = await fraudReportAction(p, d);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setReport(res);
    });
  }, []);

  const onPeriod = (p: FraudPeriod) => {
    setPeriod(p);
    load(p, date);
  };
  const onDate = (d: string) => {
    setDate(d);
    load(period, d);
  };

  const totalEvents = report.totalVoid + report.totalCancel;

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
          <Field label={period === "daily" ? "Tanggal" : period === "weekly" ? "Pilih tanggal (dalam minggu)" : "Pilih tanggal (dalam bulan)"}>
            <Input type="date" value={date} onChange={(e) => onDate(e.target.value)} className="w-48" />
          </Field>
          <div className="ml-auto flex items-center gap-2">
            {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            <Button variant="outline" size="sm" onClick={() => downloadPdf(report)} disabled={!report.configured}>
              <Download className="size-4" /> Download PDF
            </Button>
          </div>
        </div>
        <p className="mt-3 text-sm">
          Menampilkan <span className="font-semibold text-foreground">{PERIOD_LABEL[period]}</span> · periode{" "}
          <span className="font-semibold text-foreground">{report.label}</span>
        </p>
      </div>

      {!report.configured && (
        <div className="glass flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-amber-500" />
          <p>{report.error ?? "Integrasi POS belum aktif."} Data void/cancel diambil dari sistem POS — hubungi admin untuk mengaktifkan.</p>
        </div>
      )}

      {report.configured && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile icon={ShieldAlert} label="Total Kejadian" value={nf(totalEvents)} sub="Void + Cancel" />
            <StatTile icon={XCircle} label="Void" value={nf(report.totalVoid)} sub="Transaksi dibatalkan (void)" />
            <StatTile icon={XCircle} label="Cancel" value={nf(report.totalCancel)} sub="Order dibatalkan" />
          </div>

          {/* Per-outlet or aggregate */}
          {report.perOutletReliable ? (
            <OutletTable report={report} />
          ) : (
            <div className="glass rounded-2xl border border-border p-5">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                <p className="text-sm font-medium text-foreground">Rincian per outlet belum tersedia dari API POS</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Endpoint POS saat ini hanya mengembalikan total gabungan semua outlet untuk periode ini
                (<span className="font-medium text-foreground">{nf(totalEvents)}</span> kejadian). Agar bisa dipecah per outlet,
                endpoint dashboard POS perlu mendukung parameter <code className="rounded bg-muted px-1">branchId</code>.
              </p>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            Catatan: angka di atas adalah <b>jumlah transaksi</b> void/cancel dari POS. Detail order per item (menu, kasir, nominal) memerlukan endpoint order POS yang belum tersedia.
          </p>
        </>
      )}
    </div>
  );
}

function OutletTable({ report }: { report: FraudReport }) {
  const [openId, setOpenId] = React.useState<number | null>(null);
  const max = Math.max(1, ...report.outlets.map((o) => o.void + o.cancel));

  return (
    <div className="glass overflow-hidden rounded-2xl border border-border">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold text-foreground">Void & Cancel per Outlet — {report.label}</p>
        <p className="text-xs text-muted-foreground">Diurutkan dari kejadian terbanyak. Klik baris untuk lihat rincian per hari.</p>
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
              const total = o.void + o.cancel;
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
                    <td className="px-4 py-3 text-right tabular-nums">{nf(o.void)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{nf(o.cancel)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">{nf(total)}</td>
                    <td className="px-4 py-3 text-right">
                      <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-border/60 bg-muted/20">
                      <td colSpan={6} className="px-4 py-3">
                        <OutletDetail branchId={o.branchId} from={report.from} to={report.to} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {report.outlets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Tidak ada void/cancel pada periode ini. 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OutletDetail({ branchId, from, to }: { branchId: number; from: string; to: string }) {
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
  const active = days.filter((d) => d.void + d.cancel > 0);
  if (active.length === 0) return <p className="py-2 text-xs text-muted-foreground">Tidak ada void/cancel pada rentang ini.</p>;
  const max = Math.max(1, ...days.map((d) => d.void + d.cancel));
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">Rincian per hari</p>
      <div className="space-y-1">
        {active.map((d) => (
          <div key={d.date} className="flex items-center gap-3 text-xs">
            <span className="w-14 shrink-0 tabular-nums text-muted-foreground">{d.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-red-500/70" style={{ width: `${((d.void + d.cancel) / max) * 100}%` }} />
            </div>
            <span className="w-28 shrink-0 text-right tabular-nums">
              <span className="text-foreground">V {nf(d.void)}</span> · <span className="text-muted-foreground">C {nf(d.cancel)}</span>
            </span>
          </div>
        ))}
      </div>
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
  const generated = new Date().toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const rows = report.perOutletReliable
    ? report.outlets
        .map(
          (o, i) => `<tr${i === 0 ? ' class="top"' : ""}><td>${i + 1}</td><td>${esc(o.name)}</td><td class="n">${nf(o.void)}</td><td class="n">${nf(o.cancel)}</td><td class="n b">${nf(o.void + o.cancel)}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="5" class="muted">Rincian per outlet tidak tersedia dari API POS untuk periode ini. Total gabungan: ${nf(report.totalVoid + report.totalCancel)} kejadian.</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Laporan Fraud ${esc(report.label)}</title>
  <style>
    *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;margin:32px;font-size:13px}
    h1{font-size:20px;margin:0 0 2px} .sub{color:#666;margin:0 0 18px}
    .row{display:flex;gap:12px;margin-bottom:18px}
    .card{flex:1;border:1px solid #e5e5e5;border-radius:10px;padding:12px}
    .card .lbl{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.04em} .card .val{font-size:22px;font-weight:700;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:6px} th,td{padding:8px 10px;border-bottom:1px solid #eee;text-align:left}
    th{font-size:11px;text-transform:uppercase;color:#666;letter-spacing:.04em} td.n{text-align:right;font-variant-numeric:tabular-nums} td.b{font-weight:700}
    tr.top td{background:#fdecec} td.muted{color:#666;text-align:center;padding:20px}
    .foot{margin-top:24px;color:#888;font-size:11px;border-top:1px solid #eee;padding-top:10px}
    @media print{body{margin:12mm}}
  </style></head><body>
    <h1>Laporan Analisis Fraud — Void &amp; Cancel</h1>
    <p class="sub">GWG Group · Periode ${PERIOD_LABEL[report.period]}: <b>${esc(report.label)}</b> · Dibuat ${esc(generated)}</p>
    <div class="row">
      <div class="card"><div class="lbl">Total Kejadian</div><div class="val">${nf(report.totalVoid + report.totalCancel)}</div></div>
      <div class="card"><div class="lbl">Void</div><div class="val">${nf(report.totalVoid)}</div></div>
      <div class="card"><div class="lbl">Cancel</div><div class="val">${nf(report.totalCancel)}</div></div>
    </div>
    <table><thead><tr><th>#</th><th>Outlet</th><th style="text-align:right">Void</th><th style="text-align:right">Cancel</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p class="foot">Angka adalah jumlah transaksi void/cancel dari sistem POS. Lonjakan pada satu outlet menandakan potensi fraud dan perlu ditindaklanjuti. Dokumen ini dibuat otomatis oleh Operation GWG.</p>
  </body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
