import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { HcRequestReview } from "@/components/hc/request-review";

export const metadata: Metadata = { title: "Permintaan Karyawan" };

export default async function HcRecruitReviewPage() {
  const user = (await getSessionUser())!;
  if (!canReachMenu(user, "hc_reqreview")) redirect("/dashboard");
  return (
    <div className="w-full">
      <PageHeader
        icon={ClipboardCheck}
        title="Permintaan Karyawan"
        description="Tinjau permintaan pegawai dari seluruh departemen. Yang ditandai terlaksana otomatis masuk ke KPI Jumlah Rekrutmen."
      />
      <HcRequestReview mode="hc" kind="rekrutmen" />
    </div>
  );
}
