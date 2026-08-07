import { Palette } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listHcRequests } from "@/lib/data/hc-requests";
import { PageHeader } from "@/components/ui/page-header";
import { HcRequestList, NewRequestButton } from "@/components/hc/request-submit";

export const metadata: Metadata = { title: "Pengajuan Design" };

export default async function PengajuanDesignPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_request")) redirect("/dashboard");

  const rows = await listHcRequests({ department: user.department ?? "—", kind: "design" });

  return (
    <div className="w-full">
      <PageHeader
        icon={Palette}
        title="Pengajuan Design"
        description="Ajukan kebutuhan materi desain ke tim Creative. Lengkapi brief agar tidak bolak-balik revisi."
        actions={<NewRequestButton kind="design" />}
      />
      <HcRequestList rows={rows} kind="design" />
    </div>
  );
}
