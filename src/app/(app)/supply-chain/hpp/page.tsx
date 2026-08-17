import { Calculator } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listProduksi } from "@/lib/data/produksi";
import { PageHeader } from "@/components/ui/page-header";
import { ProduksiCalculator } from "@/components/produksi/produksi-calculator";

export const metadata: Metadata = { title: "Kalkulator HPP Produksi" };

/**
 * Kalkulator biaya produksi gudang.
 *
 * Berbeda dari Kalkulator HPP milik PDQ: gudang tidak menjual ke pelanggan,
 * jadi tidak ada harga jual, margin, maupun target omset. Yang dicari satu
 * angka — berapa biaya satu potong yang dikirim ke outlet.
 */
export default async function SupplyChainHppPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "sc_hpp")) redirect("/dashboard");

  const riwayat = await listProduksi();

  return (
    <div className="w-full space-y-4">
      <PageHeader
        icon={Calculator}
        title="Kalkulator HPP Produksi"
        description="Hitung biaya produksi gudang — bahan sekali masak, overhead, dan hasilnya, jadi biaya per satuan."
      />
      <ProduksiCalculator riwayat={riwayat} bisaEdit />
    </div>
  );
}
