import { Target } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { canUseOpsFinance } from "@/lib/ops/access";
import { PageHeader } from "@/components/ui/page-header";
import { OpsKpiBoardView } from "@/components/operation/ops-kpi-board";

export const metadata: Metadata = { title: "KPI Coordinator Area" };

export default async function OpsKpiPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "op_kpi")) redirect("/dashboard");

  return (
    <div className="w-full">
      <PageHeader
        icon={Target}
        title="KPI Coordinator Area"
        description="Gross Sales, Net Profit, Complain & Problem Solver per coordinator area — target dari rata-rata omzet 3 bulan terakhir"
      />
      <OpsKpiBoardView canEdit={canUseOpsFinance(user)} />
    </div>
  );
}
