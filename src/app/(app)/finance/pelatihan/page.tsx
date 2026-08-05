import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { HcRequestReview } from "@/components/hc/request-review";

export const metadata: Metadata = { title: "ACC Dana Pelatihan" };

export default async function FinanceTrainingPage() {
  const user = (await getSessionUser())!;
  if (!canReachMenu(user, "fin_training")) redirect("/dashboard");
  return (
    <div className="w-full">
      <PageHeader
        icon={Wallet}
        title="ACC Dana Pelatihan"
        description="Pengajuan pelatihan yang sudah disetujui Human Capital — tetapkan dana yang dikeluarkan sebelum program dijalankan."
      />
      <HcRequestReview mode="finance" />
    </div>
  );
}
