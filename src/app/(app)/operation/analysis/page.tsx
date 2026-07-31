import { ChartColumnBig } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { resolveRange, RANGE_NOW, isoOf } from "@/lib/date-range";
import { getOperationAnalysis } from "@/lib/data/analysis";
import { getSeasonalBranches } from "@/lib/data/seasonal";
import { PageHeader } from "@/components/ui/page-header";
import { DataAnalysis } from "@/components/operation/data-analysis";

export const metadata: Metadata = { title: "Data Analysis" };

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; outlet?: string }>;
}) {
  const user = (await getSessionUser())!;
  if (!canReachMenu(user, "op_analysis")) redirect("/dashboard");
  const sp = await searchParams;

  // Default window = FROM JANUARY (year-to-date) per requirement; otherwise the
  // exact same date-range picker the Operation Dashboard uses.
  const hasRange = !!(sp.range || (sp.from && sp.to));
  const range = hasRange
    ? resolveRange({ range: sp.range, from: sp.from, to: sp.to })
    : { from: new Date(RANGE_NOW.getFullYear(), 0, 1), to: RANGE_NOW, label: "Dari Januari" };
  const from = isoOf(range.from);
  const to = isoOf(range.to);
  const outlet = sp.outlet ?? "";

  const [data, branches] = await Promise.all([getOperationAnalysis(from, to, outlet), getSeasonalBranches()]);

  return (
    <div className="w-full">
      <PageHeader
        icon={ChartColumnBig}
        title="Data Analysis"
        description="Pusat analisis operasional — penjualan, produk, kategori, harga & margin dari data ESB terbaru"
      />
      <DataAnalysis data={data} branches={branches} rangeLabel={range.label} />
    </div>
  );
}
