import { ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canUseOpsFinance } from "@/lib/ops/access";
import { listOpOutlets, listPurchases, type PurchaseRow } from "@/lib/data/ops-finance";
import { PageHeader } from "@/components/ui/page-header";
import { OpsPembelian } from "@/components/operation/ops-pembelian";

export const metadata: Metadata = { title: "Pembelian" };

function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function PembelianPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireSessionUser();
  if (!canUseOpsFinance(user)) redirect("/dashboard");

  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : thisMonth();

  const outlets = listOpOutlets();
  const saved = await listPurchases(month);
  const byCode = new Map(saved.map((r) => [r.outletCode, r]));

  const rows: PurchaseRow[] = outlets.map((o) => {
    const p = byCode.get(o.code);
    return { outletCode: o.code, outletName: o.name, warehouse: p?.warehouse ?? 0, nonWarehouse: p?.nonWarehouse ?? 0 };
  });

  return (
    <div className="w-full">
      <PageHeader icon={ShoppingCart} title="Pembelian" description="Pembelian per outlet per bulan · Warehouse & Non-Warehouse terpisah" />
      <OpsPembelian month={month} rows={rows} />
    </div>
  );
}
