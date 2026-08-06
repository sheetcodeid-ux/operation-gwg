import { Banknote } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canUseOpsFinance } from "@/lib/ops/access";
import { listOpOutlets } from "@/lib/data/ops-finance";
import { listPnl } from "@/lib/data/ops-pnl";
import { PNL_COLS, type PnlRow } from "@/lib/ops/categories";
import { PageHeader } from "@/components/ui/page-header";
import { OpsPnl } from "@/components/operation/ops-pnl";

export const metadata: Metadata = { title: "Laba Rugi" };

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function LabaRugiPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = (await getSessionUser())!;
  if (!canUseOpsFinance(user)) redirect("/dashboard");

  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : thisMonth();

  const outlets = listOpOutlets();
  const saved = await listPnl(month);
  const byCode = new Map(saved.map((r) => [r.outletCode, r]));

  const rows: PnlRow[] = outlets.map((o) => {
    const p = byCode.get(o.code);
    const row = { outletCode: o.code, outletName: o.name } as PnlRow;
    for (const c of PNL_COLS) row[c] = p?.[c] ?? 0;
    return row;
  });

  return (
    <div className="w-full">
      <PageHeader
        icon={Banknote}
        title="Laba Rugi"
        description="Input laba rugi per outlet per bulan · Laba Bersih mengisi Actual Net Profit di KPI Coordinator Area"
      />
      <OpsPnl month={month} rows={rows} />
    </div>
  );
}
