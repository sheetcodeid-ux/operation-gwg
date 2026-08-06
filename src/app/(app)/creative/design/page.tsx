import { Palette } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { HcRequestReview } from "@/components/hc/request-review";

export const metadata: Metadata = { title: "Antrian Design" };

export default async function CreativeDesignQueuePage() {
  const user = (await getSessionUser())!;
  if (!canReachMenu(user, "creative_design")) redirect("/dashboard");
  return (
    <div className="w-full">
      <PageHeader
        icon={Palette}
        title="Antrian Design"
        description="Permintaan materi desain dari seluruh departemen. Setujui untuk mulai mengerjakan, lalu tandai selesai beserta hasilnya."
      />
      <HcRequestReview mode="hc" kind="design" />
    </div>
  );
}
