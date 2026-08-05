import { Send } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { HcRequestBoard } from "@/components/hc/request-submit";

export const metadata: Metadata = { title: "Pengajuan ke HC" };

export default async function HcRequestPage() {
  const user = (await getSessionUser())!;
  if (!canReachMenu(user, "hc_request")) redirect("/dashboard");
  return (
    <div className="w-full">
      <PageHeader
        icon={Send}
        title="Pengajuan ke Human Capital"
        description={`Permintaan pegawai & pengajuan pelatihan untuk departemen ${user.department ?? "Anda"} — diproses HC, dana pelatihan disetujui Finance.`}
      />
      <HcRequestBoard />
    </div>
  );
}
