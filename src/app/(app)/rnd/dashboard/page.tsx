import { ChartSpline } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canUseHpp } from "@/lib/hpp/access";
import { listHpp } from "@/lib/data/hpp";
import { listIngredients } from "@/lib/data/hpp-ingredients";
import { BRANDS, foodCostPct } from "@/lib/hpp/calc";
import { HPP_STATUS_META } from "@/lib/hpp/status";
import { PageHeader } from "@/components/ui/page-header";
import { HeroCard } from "@/components/dashboard/hero-card";
import { KpiCarousel, type Kpi } from "@/components/dashboard/kpi-card";
import { HppDashboard, type DashData } from "@/components/hpp/hpp-dashboard";

export const metadata: Metadata = { title: "Dashboard R&D" };

const cat = (c: string): "makanan" | "minuman" => (c === "makanan" ? "makanan" : "minuman");
const BUCKETS: { label: string; test: (p: number) => boolean; color: string }[] = [
  { label: "<25%", test: (p) => p > 0 && p < 25, color: "#10b981" },
  { label: "25–35%", test: (p) => p >= 25 && p <= 35, color: "#22c55e" },
  { label: "35–50%", test: (p) => p > 35 && p <= 50, color: "#f59e0b" },
  { label: "50–70%", test: (p) => p > 50 && p <= 70, color: "#f97316" },
  { label: ">70%", test: (p) => p > 70, color: "#ef4444" },
];
const STATUS_COLOR: Record<string, string> = { draft: "#94a3b8", submitted: "#3b82f6", verified: "#22c55e", rejected: "#ef4444" };

export default async function RndDashboardPage() {
  const user = (await getSessionUser())!;
  if (!canUseHpp(user)) redirect("/dashboard");

  const [menus, ingredients] = await Promise.all([listHpp(), listIngredients()]);

  // Ingredient → menus that reference it (for "affected" counts).
  const usage = new Map<string, string[]>();
  for (const m of menus) for (const v of m.variables) if (v.ingredientId) usage.set(v.ingredientId, [...(usage.get(v.ingredientId) ?? []), m.name]);

  const priced = menus.filter((m) => m.chosenPrice > 0);
  const fcOf = (m: (typeof menus)[number]) => foodCostPct(m.variableCost, m.chosenPrice);
  const marginOf = (m: (typeof menus)[number]) => (m.chosenPrice > 0 ? (m.chosenPrice - m.hpp) / m.chosenPrice : 0);

  const byStatus = (s: string) => menus.filter((m) => m.status === s).length;
  const overCount = priced.filter((m) => fcOf(m) > 0.7).length;
  const avgFc = priced.length ? priced.reduce((a, m) => a + fcOf(m), 0) / priced.length : 0;
  const avgMargin = priced.length ? priced.reduce((a, m) => a + marginOf(m), 0) / priced.length : 0;
  const alertsCount = ingredients.filter((i) => i.alert).length;

  const kpis: Kpi[] = [
    { label: "Total Menu", value: String(menus.length), icon: "Calculator", tone: "brand", sub: "tersimpan" },
    { label: "Diverifikasi", value: String(byStatus("verified")), icon: "CheckCircle2", tone: "success", sub: "menu final" },
    { label: "Menunggu Verifikasi", value: String(byStatus("submitted")), icon: "Send", tone: "warning", sub: "perlu ditinjau" },
    { label: "Over Cost (>70%)", value: String(overCount), icon: "AlertTriangle", tone: "danger", sub: "wajib evaluasi" },
    { label: "Rata-rata Food Cost", value: `${(avgFc * 100).toFixed(1)}%`, icon: "Coins", tone: "cyan", sub: "menu berharga" },
    { label: "Rata-rata Margin", value: `${(avgMargin * 100).toFixed(0)}%`, icon: "TrendingUp", tone: "brand", sub: "kontribusi" },
    { label: "Total Bahan Baku", value: String(ingredients.length), icon: "Package", tone: "cyan", sub: "di master" },
    { label: "Bahan Naik >5%", value: String(alertsCount), icon: "AlertTriangle", tone: "amber", sub: alertsCount ? "perlu update HPP" : "stabil" },
  ];

  const data: DashData = {
    dist: BUCKETS.map((b) => ({ label: b.label, color: b.color, jumlah: priced.filter((m) => b.test(fcOf(m) * 100)).length })),
    byBrand: BRANDS.map((brand) => {
      const rows = menus.filter((m) => m.brand === brand);
      return { brand, jumlah: rows.length, avgHpp: rows.length ? Math.round(rows.reduce((a, m) => a + m.hpp, 0) / rows.length) : 0 };
    }).filter((b) => b.jumlah > 0),
    status: (["draft", "submitted", "verified", "rejected"] as const).map((k) => ({ key: k, label: HPP_STATUS_META[k].label, value: byStatus(k), color: STATUS_COLOR[k] })),
    pending: menus.filter((m) => m.status === "submitted").map((m) => ({ id: m.id, name: m.name, brand: m.brand, category: cat(m.category) })),
    alerts: ingredients.filter((i) => i.alert).map((i) => ({ id: i.id, name: i.name, region: i.region ?? "", from: i.prevPrice ?? i.buyPrice, to: i.buyPrice, affected: (usage.get(i.id) ?? []).length })),
    recent: menus.slice(0, 5).map((m) => ({ id: m.id, name: m.name, brand: m.brand, category: cat(m.category), hpp: m.hpp, price: m.chosenPrice, statusLabel: HPP_STATUS_META[m.status].label, statusTone: HPP_STATUS_META[m.status].tone })),
    overCount,
    pricedCount: priced.length,
  };

  return (
    <div className="w-full space-y-4">
      <PageHeader icon={ChartSpline} title="Dashboard R&D" description="Ringkasan HPP, verifikasi & bahan baku divisi R&D" />
      <HeroCard name={user.name} />
      <KpiCarousel items={kpis} />
      <HppDashboard data={data} />
    </div>
  );
}
