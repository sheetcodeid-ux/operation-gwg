import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canUseOpsFinance } from "@/lib/ops/access";
import { EXPENSE_COLS, listExpenses, listOpOutlets, type ExpenseRow } from "@/lib/data/ops-finance";
import { PageHeader } from "@/components/ui/page-header";
import { OpsBeban } from "@/components/operation/ops-beban";

export const metadata: Metadata = { title: "Beban Operasional" };

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function BebanPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireSessionUser();
  if (!canUseOpsFinance(user)) redirect("/dashboard");

  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : thisMonth();

  const outlets = listOpOutlets();
  const saved = await listExpenses(month);
  const byCode = new Map(saved.map((r) => [r.outletCode, r]));

  // One editable row per outlet, pre-filled with saved values (or 0).
  const rows: ExpenseRow[] = outlets.map((o) => {
    const ex = byCode.get(o.code);
    const row = { outletCode: o.code, outletName: o.name } as ExpenseRow;
    for (const c of EXPENSE_COLS) row[c] = ex?.[c] ?? 0;
    return row;
  });

  return (
    <div className="w-full">
      <PageHeader icon={Wallet} title="Beban Operasional" description="Input beban per outlet per bulan (Finance) · 8 kategori" />
      <OpsBeban month={month} rows={rows} />
    </div>
  );
}
