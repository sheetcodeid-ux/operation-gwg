import { Package } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { listHpp } from "@/lib/data/hpp";
import { listIngredients } from "@/lib/data/hpp-ingredients";
import { PageHeader } from "@/components/ui/page-header";
import { HppIngredients, type MenuUse } from "@/components/hpp/hpp-ingredients";

export const metadata: Metadata = { title: "Master Bahan Baku" };

export default async function HppIngredientsPage() {
  const user = (await getSessionUser())!;
  const canEdit =
    canOpenMenu(user.role, "hpp", user.grants) ||
    user.department === "Product Development & Quality" ||
    user.department === "Food & Beverage";
  if (!canEdit) redirect("/dashboard");

  const [ingredients, records] = await Promise.all([listIngredients(), listHpp()]);
  // Which saved menus reference each master ingredient (for the >5% impact view).
  const menus: MenuUse[] = records.map((r) => ({
    id: r.id,
    name: r.name,
    ingredientIds: r.variables.map((v) => v.ingredientId).filter((x): x is string => !!x),
  }));

  return (
    <div className="w-full">
      <PageHeader
        icon={Package}
        title="Master Bahan Baku"
        description="Library bahan baku dengan harga tertinggi per wilayah — deteksi otomatis kenaikan >5%"
      />
      <HppIngredients ingredients={ingredients} menus={menus} canEdit={canEdit} />
    </div>
  );
}
