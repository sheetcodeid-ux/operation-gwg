import { Calculator } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { listHpp } from "@/lib/data/hpp";
import { listIngredients } from "@/lib/data/hpp-ingredients";
import { foodCostPct } from "@/lib/hpp/calc";
import { PageHeader } from "@/components/ui/page-header";
import { HppCalculator, type IngredientOption } from "@/components/hpp/hpp-calculator";
import { HppGuide, type GuideStats } from "@/components/hpp/hpp-guide";

export const metadata: Metadata = { title: "Kalkulator HPP" };

/** Who may open the HPP calculator: R&D roles / grants / admin, or anyone whose
 *  department is R&D or Food & Beverage (the kitchen & bar teams that cost menu). */
export default async function HppPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const user = (await getSessionUser())!;
  const { edit } = await searchParams;
  const canEdit =
    canOpenMenu(user.role, "hpp", user.grants) ||
    user.department === "R&D" ||
    user.department === "Food & Beverage";
  if (!canEdit) redirect("/dashboard");

  const [history, rawIngredients] = await Promise.all([listHpp(), listIngredients()]);
  const ingredients: IngredientOption[] = rawIngredients.map((i) => ({
    id: i.id,
    name: i.name,
    buyPrice: i.buyPrice,
    buyQty: i.buyQty,
    buyUnit: i.buyUnit,
  }));

  // Live stats for the data-driven guide (auto-adjusts as the team works).
  const canVerify = user.role === "super_admin" || user.department === "Food & Beverage";
  const guideStats: GuideStats = {
    ingredients: rawIngredients.length,
    ingredientAlerts: rawIngredients.filter((i) => i.alert).length,
    menus: history.length,
    draft: history.filter((r) => r.status === "draft").length,
    submitted: history.filter((r) => r.status === "submitted").length,
    verified: history.filter((r) => r.status === "verified").length,
    rejected: history.filter((r) => r.status === "rejected").length,
    overCost: history.filter((r) => r.chosenPrice > 0 && foodCostPct(r.variableCost, r.chosenPrice) > 0.7).length,
  };

  return (
    <div className="w-full space-y-4">
      <PageHeader
        icon={Calculator}
        title="Kalkulator HPP"
        description="Harga Pokok Produksi R&D — hitung biaya, saran harga jual, BEP & proyeksi laba"
      />
      <HppGuide stats={guideStats} canVerify={canVerify} />
      <HppCalculator initialHistory={history} canEdit={canEdit} ingredients={ingredients} autoLoadId={edit} />
    </div>
  );
}
