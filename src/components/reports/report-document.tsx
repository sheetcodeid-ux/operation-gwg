import { ArrowDownRight, ArrowUpRight, CheckCircle2, Lightbulb, TriangleAlert } from "lucide-react";
import { aggregateOutlets, rataAudit, reportPeriodCompare } from "@/lib/data/store";
import { KPI_TARGETS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const TAK_ADA = "Belum ada data";

/** Skor untuk teks; yang belum dinilai tidak dipaksa menjadi angka. */
const skor = (v: number | null, digit = 1) => (v === null ? TAK_ADA : v.toFixed(digit));

/**
 * `null` = perubahannya tidak terukur, bukan 0%.
 *
 * Lencana 0% berwarna hijau berarti "stabil", dan itu klaim tentang periode
 * yang salah satu sisinya tidak punya audit sama sekali.
 */
function DeltaBadge({ value, goodWhenUp = true }: { value: number | null; goodWhenUp?: boolean }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        Tak terukur
      </span>
    );
  }
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
    { label: "Hospitality", value: skor(data.hospitality.cur), delta: data.hospitality.delta, good: true },
    { label: "Hygiene", value: skor(data.hygiene.cur), delta: data.hygiene.delta, good: true },
    { label: "Komplain (30h)", value: String(data.complaintsReceived.cur), delta: data.complaintsReceived.delta, good: false },
    { label: "Terselesaikan", value: String(data.complaintsResolved.cur), delta: data.complaintsResolved.delta, good: true },
    { label: "Task Completion", value: `${agg.taskCompletion}%`, delta: data.tasksCompleted.delta, good: true },
  ];

  // Di bawah target hanya bisa DIBUKTIKAN oleh skor yang ada. Outlet tanpa
  // audit tidak dihitung di bawah target - dan justru karena itu ia tidak boleh
  // hilang dari laporan, jadi jumlahnya disebut terpisah. Ambangnya sendiri
  // (`KPI_TARGETS`) tidak diubah.
  const terukur = (o: { hospCur: number | null; hygCur: number | null }) => o.hospCur !== null || o.hygCur !== null;
  const belowTarget = data.perOutlet.filter(
    (o) =>
      (o.hospCur !== null && o.hospCur < KPI_TARGETS.hospitality) ||
      (o.hygCur !== null && o.hygCur < KPI_TARGETS.hygiene),
  );
  const belumDinilai = data.perOutlet.filter((o) => !terukur(o));
  const improved = data.perOutlet.filter((o) => o.hospPrev !== null && o.hospPrev > 0 && o.hospCur !== null && o.hospCur > o.hospPrev);
  // Mutu gabungan per outlet; yang tidak terukur turun ke bawah daftar tanpa
  // diberi angka pengganti.
  const mutu = (o: { hospCur: number | null; hygCur: number | null }) => rataAudit([o.hospCur, o.hygCur]);
  const sorted = [...data.perOutlet].sort((a, b) => {
    const x = mutu(a);
    const y = mutu(b);
    if (x === null && y === null) return a.name.localeCompare(b.name, "id");
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x;
  });

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
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="whitespace-nowrap border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
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
                const d =
                  o.hospPrev !== null && o.hospPrev > 0 && o.hospCur !== null
                    ? Math.round(((o.hospCur - o.hospPrev) / o.hospPrev) * 100)
                    : null;
                return (
                  <tr key={o.code} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-foreground">{o.name}</span>
                      <span className="ml-1 text-[11px] text-muted-foreground">{o.code}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-foreground">{skor(o.hospCur, 0)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{skor(o.hospPrev, 0)}</td>
                    <td className="px-3 py-2.5 text-center"><DeltaBadge value={d} /></td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-foreground">{skor(o.hygCur, 0)}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{skor(o.hygPrev, 0)}</td>
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
            ? `${improved.length} outlet membaik MoM. Tertinggi: ${sorted[0]?.name ?? "—"} (${skor(sorted[0]?.hospCur ?? null, 0)}).`
            : "Belum ada outlet yang terbukti membaik dibanding periode sebelumnya."}
        </Callout>
        <Callout tone="danger" icon={TriangleAlert} title="Perlu Perhatian">
          {/* Kalimat "semua outlet memenuhi target" tidak boleh diucapkan
              selama masih ada outlet yang belum diaudit - itu klaim tentang
              outlet yang tak seorang pun periksa. */}
          {belowTarget.length > 0
            ? `${belowTarget.length} outlet di bawah target (Hosp/Hyg < ${KPI_TARGETS.hospitality}). Contoh: ${belowTarget[0]?.name}.`
            : belumDinilai.length > 0
              ? `Tidak ada outlet terukur di bawah target, tetapi ${belumDinilai.length} outlet belum punya audit pada periode ini.`
              : "Semua outlet memenuhi target minimum."}
          {belowTarget.length > 0 && belumDinilai.length > 0
            ? ` ${belumDinilai.length} outlet lain belum diaudit.`
            : ""}
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
          <li>• Rata-rata hospitality {skor(agg.hospitality)} dan hygiene {skor(agg.hygiene)} dari {agg.outlets} outlet.</li>
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
