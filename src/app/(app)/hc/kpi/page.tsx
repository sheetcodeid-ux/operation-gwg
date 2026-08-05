import { Target } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { KpiBoard } from "@/components/hc/kpi-board";

export const metadata: Metadata = { title: "KPI Human Capital" };

export default async function HcKpiPage() {
  const user = (await getSessionUser())!;
  if (!canReachMenu(user, "hc_kpi")) redirect("/dashboard");

  return (
    <div className="w-full">
      <PageHeader
        icon={Target}
        title="KPI Human Capital"
        description="Enam indikator KPI departemen HC — target, realisasi, % capaian & kontribusi ke total skor, lengkap dengan bukti pendukung."
      />
      <KpiBoard canEdit />
    </div>
  );
}
