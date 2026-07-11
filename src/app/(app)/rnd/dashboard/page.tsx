import { ChartSpline } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canUseHpp } from "@/lib/hpp/access";
import { listHpp } from "@/lib/data/hpp";
import { listIngredients } from "@/lib/data/hpp-ingredients";
import { latestSalesMonth, listSales } from "@/lib/data/hpp-sales";
import { gwgmanageConfigured } from "@/lib/integrations/gwgmanage";
import { HPP_STATUS_META } from "@/lib/hpp/status";
import { PageHeader } from "@/components/ui/page-header";
import { HeroCard } from "@/components/dashboard/hero-card";
import { HppDashboard, type DashIngredient, type DashMenu, type DashSales } from "@/components/hpp/hpp-dashboard";
import type { SalesMenu, SalesRowLite } from "@/components/hpp/hpp-sales-panel";

export const metadata: Metadata = { title: "Dashboard R&D" };

export default async function RndDashboardPage() {
  const user = (await getSessionUser())!;
  if (!canUseHpp(user)) redirect("/dashboard");

  const [menus, ingredients, salesMonth] = await Promise.all([listHpp(), listIngredients(), latestSalesMonth()]);
  const salesRows = salesMonth ? await listSales(salesMonth) : [];

  const usage = new Map<string, number>();
  for (const m of menus) for (const v of m.variables) if (v.ingredientId) usage.set(v.ingredientId, (usage.get(v.ingredientId) ?? 0) + 1);

  const dashMenus: DashMenu[] = menus.map((m) => ({
    id: m.id,
    name: m.name,
    brand: m.brand,
    category: m.category,
    status: m.status,
    statusLabel: HPP_STATUS_META[m.status].label,
    statusTone: HPP_STATUS_META[m.status].tone,
    hpp: m.hpp,
    price: m.chosenPrice,
    variableCost: m.variableCost,
    createdAt: m.createdAt,
    reviewedAt: m.reviewedAt,
  }));
  const dashIngredients: DashIngredient[] = ingredients.map((i) => ({
    id: i.id,
    name: i.name,
    region: i.region ?? "",
    from: i.prevPrice ?? i.buyPrice,
    to: i.buyPrice,
    alert: i.alert,
    affected: usage.get(i.id) ?? 0,
  }));

  const salesMenus: SalesMenu[] = menus.map((m) => ({
    name: m.name,
    brand: m.brand,
    category: m.category,
    hpp: m.hpp,
    price: m.chosenPrice,
    variableCost: m.variableCost,
    targetSales: m.targetSales,
  }));
  const salesRowsLite: SalesRowLite[] = salesRows.map((s) => ({ name: s.menuName, category: s.category, qty: s.qty, amount: s.amount }));
  const sales: DashSales = {
    configured: gwgmanageConfigured(),
    month: salesMonth,
    syncedAt: salesRows[0]?.syncedAt ?? null,
    menus: salesMenus,
    rows: salesRowsLite,
  };

  return (
    <div className="w-full space-y-4">
      <PageHeader icon={ChartSpline} title="Dashboard R&D" description="Ringkasan HPP, verifikasi & bahan baku divisi R&D" />
      <HeroCard name={user.name} />
      <HppDashboard menus={dashMenus} ingredients={dashIngredients} sales={sales} />
    </div>
  );
}
