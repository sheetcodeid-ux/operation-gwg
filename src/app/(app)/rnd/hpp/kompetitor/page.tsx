import { Store } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canUseHpp } from "@/lib/hpp/access";
import { listHpp } from "@/lib/data/hpp";
import { competitorInsights, listCompetitorPrices } from "@/lib/data/hpp-competitors";
import { listEsbMenus } from "@/lib/data/esb-menu";
import { PageHeader } from "@/components/ui/page-header";
import { HppCompetitors, type MenuOption } from "@/components/hpp/hpp-competitors";

export const metadata: Metadata = { title: "Analytics Harga Kompetitor" };

export default async function HppCompetitorPage() {
  const user = (await getSessionUser())!;
  if (!canUseHpp(user)) redirect("/dashboard");

  // Dua query, lalu dipakai ulang oleh analisisnya — bukan diambil dua kali.
  const [records, prices, esbMenus] = await Promise.all([listHpp(), listCompetitorPrices(), listEsbMenus()]);
  const insights = await competitorInsights({ records, prices });

  // Dua sumber menu: hasil Kalkulator HPP (punya HPP, bisa diuji marginnya) dan
  // katalog ESB (semua menu yang benar-benar dijual, termasuk yang belum
  // dihitung HPP-nya). Nama yang sudah ada di HPP tidak diulang dari ESB.
  const fromHpp: MenuOption[] = records.map((r) => ({ id: r.id, name: r.name, brand: r.brand, source: "hpp" }));
  const taken = new Set(fromHpp.map((m) => m.name.trim().toLowerCase()));
  const fromEsb: MenuOption[] = esbMenus
    .filter((m) => m.menu && !taken.has(m.menu.trim().toLowerCase()))
    .map((m) => ({ id: `esb:${m.menuCode || m.menu}`, name: m.menu, brand: m.categoryDetail || m.category || "ESB", source: "esb" }));
  const menus: MenuOption[] = [...fromHpp, ...fromEsb];

  return (
    <div className="w-full">
      <PageHeader
        icon={Store}
        title="Analytics Harga Kompetitor"
        description="Bandingkan harga kita dengan harga pasar — setiap rekomendasi diuji dulu terhadap HPP"
      />
      <HppCompetitors insights={insights} prices={prices} menus={menus} canEdit={canUseHpp(user)} />
    </div>
  );
}
