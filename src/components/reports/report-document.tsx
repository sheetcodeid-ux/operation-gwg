import { ArrowDownRight, ArrowUpRight, CheckCircle2, Lightbulb, TriangleAlert } from "lucide-react";
import { aggregateOutlets, reportPeriodCompare } from "@/lib/data/store";
import { KPI_TARGETS } from "@/lib/constants";
import { cn } from "@/lib/utils";

function DeltaBadge({ value, goodWhenUp = true }: { value: number; goodWhenUp?: boolean }) {
  const up = value >= 0;
  const good = goodWhenUp ? up : !up;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
        good ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" : "bg-red-500/15 text-red-600 dark:text-red-300",
      )}
    >
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(value)}%
    </span>
  );
}

const CHIP_TONE = [
  "bg-emerald-500/10 ring-emerald-500/20",
  "bg-teal-500/10 ring-teal-500/20",
  "bg-amber-500/10 ring-amber-500/20",
  "bg-sky-500/10 ring-sky-500/20",
  "bg-violet-500/10 ring-violet-500/20",
];

export function ReportDocument({ outletIds }: { outletIds: string[] }) {
  const data = reportPeriodCompare(outletIds);
  const agg = aggregateOutlets(outletIds);

  const chips = [
    { label: "Hospitality", value: data.hospitality.cur.toFixed(1), delta: data.hospitality.delta, good: true },
    { label: "Hygiene", value: data.hygiene.cur.toFixed(1), delta: data.hygiene.delta, good: true },
    { label: "Komplain (30h)", value: String(data.complaintsReceived.cur), delta: data.complaintsReceived.delta, good: false },
    { label: "Terselesaikan", value: String(data.complaintsResolved.cur), delta: data.complaintsResolved.delta, good: true },
    { label: "Task Completion", value: `${agg.taskCompletion}%`, delta: data.tasksCompleted.delta, good: true },
  ];

  const belowTarget = data.perOutlet.filter((o) => o.hospCur < KPI_TARGETS.hospitality || o.hygCur < KPI_TARGETS.hygiene);
  const improved = data.perOutlet.filter((o) => o.hospPrev > 0 && o.hospCur > o.hospPrev);
  const sorted = [...data.perOutlet].sort((a, b) => b.hospCur + b.hygCur - (a.hospCur + a.hygCur));

  return (
    <div className="space-y-5">
      {/* KPI chips */}
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ringkasan KPI</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {chips.map((c, i) => (
            <div key={c.label} className={cn("rounded-xl p-3 ring-1", CHIP_TONE[i % CHIP_TONE.length])}>
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{c.value}</p>
              <div className="mt-1">
                <DeltaBadge value={c.delta} goodWhenUp={c.good} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MoM table */}
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Performa per Outlet — Bulan Ini vs Bulan Lalu
        </h3>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5">Outlet</th>
                <th className="px-3 py-2.5 text-center">Hosp. Ini</th>
                <th className="px-3 py-2.5 text-center">Hosp. Lalu</th>
                <th className="px-3 py-2.5 text-center">Δ</th>
                <th className="px-3 py-2.5 text-center">Hyg. Ini</th>
                <th className="px-3 py-2.5 text-center">Hyg. Lalu</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((o) => {
                const d = o.hospPrev > 0 ? Math.round(((o.hospCur - o.hospPrev) / o.hospPrev) * 100) : 0;
                return (
                  <tr key={o.code} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-foreground">{o.name}</span>
                      <span className="ml-1 text-[11px] text-muted-foreground">{o.code}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-foreground">{o.hospCur.toFixed(0)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{o.hospPrev.toFixed(0)}</td>
                    <td className="px-3 py-2.5 text-center"><DeltaBadge value={d} /></td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-foreground">{o.hygCur.toFixed(0)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{o.hygPrev.toFixed(0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Insight callouts */}
      <section className="grid gap-3 lg:grid-cols-3 print-break">
        <Callout tone="success" icon={CheckCircle2} title="Positif">
          {improved.length > 0
            ? `${improved.length} outlet membaik MoM. Tertinggi: ${sorted[0]?.name ?? "—"} (${sorted[0]?.hospCur.toFixed(0)}).`
            : "Skor relatif stabil dibanding bulan lalu."}
        </Callout>
        <Callout tone="danger" icon={TriangleAlert} title="Perlu Perhatian">
          {belowTarget.length > 0
            ? `${belowTarget.length} outlet di bawah target (Hosp/Hyg < ${KPI_TARGETS.hospitality}). Contoh: ${belowTarget[0]?.name}.`
            : "Semua outlet memenuhi target minimum."}
        </Callout>
        <Callout tone="warning" icon={Lightbulb} title="Rekomendasi">
          {belowTarget.length > 0
            ? "Lakukan coaching hospitality & audit hygiene tambahan pada outlet di bawah target; review mingguan dengan CA."
            : "Pertahankan standar; fokus pada percepatan penyelesaian komplain."}
        </Callout>
      </section>

      {/* Conclusion */}
      <section className="rounded-xl border border-border bg-muted/30 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="inline-block h-4 w-1 rounded bg-primary" /> Kesimpulan &amp; Tindak Lanjut
        </h3>
        <ul className="space-y-1.5 text-sm text-foreground/90">
          <li>• Rata-rata hospitality {agg.hospitality.toFixed(1)} dan hygiene {agg.hygiene.toFixed(1)} dari {agg.outlets} outlet.</li>
          <li>• {belowTarget.length} outlet perlu perhatian; resolution rate komplain {agg.resolution}%.</li>
          <li>• Penyelesaian task {agg.taskCompletion}% · {agg.eventsRunning} event berjalan.</li>
        </ul>
      </section>
    </div>
  );
}

function Callout({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: "success" | "danger" | "warning";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  const map = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    danger: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  } as const;
  return (
    <div className={cn("rounded-xl border p-3", map[tone])}>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
        <Icon className="size-4" /> {title}
      </p>
      <p className="text-sm text-foreground/80">{children}</p>
    </div>
  );
}
