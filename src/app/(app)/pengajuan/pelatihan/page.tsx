import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { HcRequestBoard } from "@/components/hc/request-submit";

export const metadata: Metadata = { title: "Pengajuan Pelatihan" };

export default async function PengajuanPelatihanPage() {
  const user = (await getSessionUser())!;
  if (!canReachMenu(user, "hc_request")) redirect("/dashboard");
  return (
    <div className="w-full">
      <PageHeader
        icon={GraduationCap}
        title="Pengajuan Pelatihan"
        description="ACC Human Capital, lalu Finance menyetujui dananya sebelum pelatihan dijalankan."
      />
      <HcRequestBoard kind="pelatihan" />
    </div>
  );
}
