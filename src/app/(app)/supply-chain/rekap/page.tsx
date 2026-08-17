import { Table2 } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listProduksi } from "@/lib/data/produksi";
import { PageHeader } from "@/components/ui/page-header";
import { ProduksiRekap } from "@/components/produksi/produksi-rekap";

export const metadata: Metadata = { title: "Database Produksi" };

export default async function SupplyChainRekapPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "sc_rekap")) redirect("/dashboard");

  const rows = await listProduksi();

  return (
    <div className="w-full space-y-4">
      <PageHeader
        icon={Table2}
        title="Database Produksi"
        description="Seluruh resep produksi gudang beserta biaya bahan, overhead, dan biaya per satuannya."
      />
      <ProduksiRekap rows={rows} />
    </div>
  );
}
