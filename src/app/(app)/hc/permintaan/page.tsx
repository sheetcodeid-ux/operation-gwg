import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { HcRequestReview } from "@/components/hc/request-review";

export const metadata: Metadata = { title: "Permintaan & Pelatihan" };

export default async function HcRequestReviewPage() {
  const user = (await getSessionUser())!;
  if (!canReachMenu(user, "hc_reqreview")) redirect("/dashboard");
  return (
    <div className="w-full">
      <PageHeader
        icon={ClipboardCheck}
        title="Permintaan Pegawai & Pelatihan"
        description="Tinjau pengajuan dari seluruh departemen. Yang ditandai terlaksana otomatis masuk ke KPI Human Capital."
      />
      <HcRequestReview mode="hc" />
    </div>
  );
}
