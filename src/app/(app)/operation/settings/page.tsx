import { Settings2 } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canUseOpsFinance } from "@/lib/ops/access";
import { getOpsSettings } from "@/lib/data/ops-settings";
import { PageHeader } from "@/components/ui/page-header";
import { OpsSettingsForm } from "@/components/operation/ops-settings";

export const metadata: Metadata = { title: "Pengaturan Threshold" };

export default async function SettingsPage() {
  const user = (await getSessionUser())!;
  if (!canUseOpsFinance(user)) redirect("/dashboard");
  const settings = await getOpsSettings();
  return (
    <div className="w-full">
      <PageHeader icon={Settings2} title="Pengaturan Threshold" description="Ambang batas beban, margin & pembelian yang dipakai indikator Dashboard (Juknis bab 6)" />
      <OpsSettingsForm initial={settings} />
    </div>
  );
}
