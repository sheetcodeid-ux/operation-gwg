import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { monitoringHcmos } from "@/lib/data/hcmos-monitoring";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { MonitoringBoard } from "@/components/hcmos/monitoring-board";

export const metadata: Metadata = { title: "Dashboard Monitoring — HC-MOS" };

export default async function MonitoringPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const tabs = await monitoringHcmos(user);

  // Tanpa kepala halaman: bingkai modulnya membawa judul metrik yang sedang
  // dibuka, angka ringkas, dan panduannya sendiri.
  return (
    <div className="flex w-full flex-col">
      <Link href="/hc-mos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>
      <KonteksModul panduan="monitoring" />
      <MonitoringBoard tabs={tabs} />
    </div>
  );
}
