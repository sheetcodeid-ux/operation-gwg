import { Store } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canUseHpp } from "@/lib/hpp/access";
import { listHpp } from "@/lib/data/hpp";
import { competitorInsights, listCompetitorPrices } from "@/lib/data/hpp-competitors";
import { PageHeader } from "@/components/ui/page-header";
import { HppCompetitors, type MenuOption } from "@/components/hpp/hpp-competitors";

export const metadata: Metadata = { title: "Analytics Harga Kompetitor" };

export default async function HppCompetitorPage() {
  const user = (await getSessionUser())!;
  if (!canUseHpp(user)) redirect("/dashboard");

  // Dua query, lalu dipakai ulang oleh analisisnya — bukan diambil dua kali.
  const [records, prices] = await Promise.all([listHpp(), listCompetitorPrices()]);
  const insights = await competitorInsights({ records, prices });
  const menus: MenuOption[] = records.map((r) => ({ id: r.id, name: r.name, brand: r.brand }));

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
