import { Calculator } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { listHpp } from "@/lib/data/hpp";
import { listIngredients } from "@/lib/data/hpp-ingredients";
import { PageHeader } from "@/components/ui/page-header";
import { HppCalculator, type IngredientOption } from "@/components/hpp/hpp-calculator";

export const metadata: Metadata = { title: "Kalkulator HPP" };

/** Who may open the HPP calculator: R&D roles / grants / admin, or anyone whose
 *  department is R&D or Food & Beverage (the kitchen & bar teams that cost menu). */
export default async function HppPage() {
  const user = (await getSessionUser())!;
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

  return (
    <div className="w-full">
      <PageHeader
        icon={Calculator}
        title="Kalkulator HPP"
        description="Harga Pokok Produksi R&D — hitung biaya, saran harga jual, BEP & proyeksi laba"
      />
      <HppCalculator initialHistory={history} canEdit={canEdit} ingredients={ingredients} />
    </div>
  );
}
