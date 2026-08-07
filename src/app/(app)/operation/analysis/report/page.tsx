import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { resolveRange, RANGE_NOW, isoOf } from "@/lib/date-range";
import { getOperationAnalysis, analysisBranchList } from "@/lib/data/analysis";
import { formatIDR, formatNumber } from "@/lib/utils";
import { PrintButton } from "@/components/reports/print-button";

export const metadata: Metadata = { title: "Laporan Analisis Operasional" };

const rp = (n: number) => formatIDR(n);

export default async function AnalysisReportPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; outlet?: string }>;
}) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "op_analysis")) redirect("/dashboard");
  const sp = await searchParams;

  const hasRange = !!(sp.range || (sp.from && sp.to));
  const range = hasRange
    ? resolveRange({ range: sp.range, from: sp.from, to: sp.to })
    : { from: new Date(RANGE_NOW.getFullYear(), 0, 1), to: RANGE_NOW, label: "Dari Januari" };
  const from = isoOf(range.from);
  const to = isoOf(range.to);
  const outlet = sp.outlet ?? "";

  const [data, branches] = await Promise.all([getOperationAnalysis(from, to, outlet), analysisBranchList()]);
  const nameOf = (id: string) => branches.find((b) => b.id === id)?.name ?? id;
  const outletName = outlet ? nameOf(outlet) : "Semua Outlet";
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const generated = new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
  const k = data.kpi;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={qs ? `/operation/analysis?${qs}` : "/operation/analysis"} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <ArrowLeft className="size-4" /> Kembali
        </Link>
        <PrintButton label="Cetak / Simpan PDF" />
      </div>

      <div className="space-y-4">
        {/* Header */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Operation GWG</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Laporan Analisis Operasional</h1>
              <p className="mt-1 text-sm text-muted-foreground">Periode: {range.label} ({from} → {to}) · Outlet: {outletName}</p>
            </div>
            <div className="text-right text-[11px] text-muted-foreground">
              <p>Dibuat: {generated}</p>
              <p>Oleh: {user.name}</p>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <Sec title="Executive Summary">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Total Sales (Gross)" value={rp(k.totalSales)} />
            <Kpi label="Net Sales" value={rp(k.netSales)} />
            <Kpi label="Growth vs Sebelumnya" value={k.growthPct === null ? "—" : `${k.growthPct > 0 ? "+" : ""}${k.growthPct}%`} />
            <Kpi label="Achievement Target" value={k.achievementPct === null ? "—" : `${k.achievementPct}%`} />
            <Kpi label="Rata-rata / Hari" value={rp(k.avgPerDay)} />
            <Kpi label="Produk Terjual (30h)" value={formatNumber(k.productsSold)} />
            <Kpi label="Kategori" value={formatNumber(k.categories)} />
            <Kpi label="Rata-rata Margin" value={k.avgMarginPct === null ? "—" : `${k.avgMarginPct}%`} />
          </div>
          {data.hasSales && (
            <p className="mt-3 text-sm leading-relaxed text-foreground/80">
              Net sales periode ini <strong>{rp(k.netSales)}</strong>
              {k.growthPct !== null && <> ({k.growthPct >= 0 ? "naik" : "turun"} {Math.abs(k.growthPct)}% vs periode sebelumnya {rp(k.prevNet)})</>}
              {k.achievementPct !== null && <>, dengan pencapaian <strong>{k.achievementPct}%</strong> dari target {rp(k.targetNet)}</>}.
              {data.peakDay && <> Hari tertinggi {data.peakDay.label} ({rp(data.peakDay.net)}).</>}
            </p>
          )}
        </Sec>

        {/* Sales */}
        {data.byMonth.length > 0 && (
          <Sec title="Sales Analysis">
            <Table head={["Bulan", "Net Sales"]} rows={data.byMonth.map((m) => [m.name, rp(m.value)])} />
          </Sec>
        )}

        {/* Outlet Performance */}
        {data.outletPerformance.length > 0 && (
          <Sec title="Outlet Performance">
            <Table
              head={["#", "Outlet", "Net Sales", "Kontribusi", "Growth"]}
              rows={data.outletPerformance.slice(0, 20).map((o, i) => [String(i + 1), nameOf(o.branch), rp(o.net), `${o.share}%`, o.growthPct === null ? "—" : `${o.growthPct > 0 ? "+" : ""}${o.growthPct}%`])}
            />
          </Sec>
        )}

        {/* Products */}
        {data.bestSellers.length > 0 && (
          <Sec title="Product Analysis" breakBefore>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Best Seller</p>
            <Table head={["#", "Produk", "Kategori", "Qty", "Kontribusi"]} rows={data.bestSellers.map((p, i) => [String(i + 1), p.menu, p.category, formatNumber(p.qty), `${p.share}%`])} />
            {data.deadProducts.length > 0 && <p className="mt-3 text-sm text-foreground/80"><strong>{data.deadProducts.length}</strong> produk tanpa penjualan dalam 30 hari terakhir (kandidat evaluasi).</p>}
          </Sec>
        )}

        {/* Categories */}
        {data.categoriesRows.length > 0 && (
          <Sec title="Category Analysis">
            <Table head={["Kategori", "Qty", "Kontribusi"]} rows={data.categoriesRows.slice(0, 10).map((c) => [c.category, formatNumber(c.qty), `${c.share}%`])} />
          </Sec>
        )}

        {/* Price & Margin */}
        {(data.priceStats || data.lowMargins.length > 0) && (
          <Sec title="Price & Margin Analysis" breakBefore>
            {data.priceStats && (
              <p className="mb-3 text-sm text-foreground/80">
                Rata-rata harga jual <strong>{rp(data.priceStats.avg)}</strong>
                {data.priceStats.highest && <> · tertinggi {data.priceStats.highest.menu} ({rp(data.priceStats.highest.unitPrice)})</>}
                {data.priceStats.lowest && <> · terendah {data.priceStats.lowest.menu} ({rp(data.priceStats.lowest.unitPrice)})</>}.
              </p>
            )}
            {data.lowMargins.length > 0 && (
              <>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Margin Tipis (&lt; 30%)</p>
                <Table head={["Produk", "Kategori", "Harga", "Margin"]} rows={data.lowMargins.map((m) => [m.name, m.category, rp(m.price), `${m.marginPct}%`])} />
              </>
            )}
          </Sec>
        )}

        {/* Alerts */}
        {data.alerts.length > 0 && (
          <Sec title="Alert">
            <ul className="space-y-1.5">
              {data.alerts.map((a, i) => (
                <li key={i} className="text-sm text-foreground/80">
                  <strong>{a.title}:</strong> {a.detail}
                </li>
              ))}
            </ul>
          </Sec>
        )}

        {/* Insight + Recommendation */}
        {(data.insights.length > 0 || data.recommendations.length > 0) && (
          <Sec title="AI Insight & Rekomendasi" breakBefore>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Insight</p>
                <ul className="space-y-1.5">
                  {data.insights.map((it, i) => <li key={i} className="text-sm text-foreground/80"><strong>{it.title}:</strong> {it.detail}</li>)}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Rekomendasi</p>
                <ul className="space-y-1.5">
                  {data.recommendations.map((it, i) => <li key={i} className="text-sm text-foreground/80"><strong>{it.title}:</strong> {it.detail}</li>)}
                </ul>
              </div>
            </div>
          </Sec>
        )}

        <p className="pt-2 text-center text-[11px] text-muted-foreground">
          Laporan dihitung otomatis dari data ESB terbaru · Operation GWG · Rahasia internal.
        </p>
      </div>
    </div>
  );
}

function Sec({ title, children, breakBefore }: { title: string; children: React.ReactNode; breakBefore?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-6 ${breakBefore ? "print-break" : ""}`}>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-bold text-foreground">{value}</p>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {head.map((h) => <th key={h} className="py-1.5 pr-3 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50">
              {r.map((c, j) => <td key={j} className="py-1.5 pr-3 text-foreground/85">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
