import { TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { getOpsDashboard } from "@/lib/data/ops-dashboard";
import { PageHeader } from "@/components/ui/page-header";
import { OperationDashboard2 } from "@/components/dashboard/operation-dashboard-2";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const user = await requireSessionUser();
  if (!canOpenMenu(user.role, "analytics", user.grants)) redirect("/dashboard");

  const opsData = await getOpsDashboard({ user });

  return (
    <div className="w-full">
      <PageHeader
        icon={TrendingUp}
        title="Analytics"
        description="Ringkasan finansial & operasional seluruh cabang"
      />
      <OperationDashboard2 initial={opsData} />
    </div>
  );
}
