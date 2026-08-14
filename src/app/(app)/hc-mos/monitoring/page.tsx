import { ArrowLeft, LayoutDashboard } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { monitoringHcmos } from "@/lib/data/hcmos-monitoring";
import { PageHeader } from "@/components/ui/page-header";
import { MonitoringBoard } from "@/components/hcmos/monitoring-board";

export const metadata: Metadata = { title: "Dashboard Monitoring — HC-MOS" };

export default async function MonitoringPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const tabs = await monitoringHcmos(user);

  return (
    <div className="w-full">
      <Link href="/hc-mos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard Monitoring"
        description="Sebelas metrik HR — seluruh angkanya dihitung dari data yang sudah masuk, bukan angka contoh."
      />
      <MonitoringBoard tabs={tabs} />
    </div>
  );
}
