import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { PanduanModul } from "@/components/hcmos/panduan-modul";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { HcRequestReview } from "@/components/hc/request-review";

export const metadata: Metadata = { title: "Pelatihan" };

export default async function HcTrainingReviewPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_training")) redirect("/dashboard");
  return (
    <div className="w-full">
      <PageHeader
        icon={GraduationCap}
        title="Pelatihan"
        description="Tinjau pengajuan pelatihan departemen. Disetujui di sini, lalu Finance menyetujui dananya."
        actions={<PanduanModul panduan="hc_pelatihan" />}
      />
      <KonteksModul panduan="hc_pelatihan" />
      <HcRequestReview mode="hc" kind="pelatihan" />
    </div>
  );
}
