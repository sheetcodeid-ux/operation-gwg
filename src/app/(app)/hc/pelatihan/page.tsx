import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { HcRequestReview } from "@/components/hc/request-review";

export const metadata: Metadata = { title: "Pelatihan" };

export default async function HcTrainingReviewPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_training")) redirect("/dashboard");
  // Tanpa kepala halaman: bingkai antreannya membawa judul, angka ringkas,
  // pencarian, dan panduannya sendiri.
  return (
    <div className="flex w-full flex-col">
      <KonteksModul panduan="hc_pelatihan" />
      <HcRequestReview
        mode="hc"
        kind="pelatihan"
        bingkai={{ judul: "Pelatihan", ikon: "GraduationCap", gradien: "from-indigo-500 via-blue-500 to-sky-600 shadow-blue-500/20", panduan: "hc_pelatihan" }}
      />
    </div>
  );
}
