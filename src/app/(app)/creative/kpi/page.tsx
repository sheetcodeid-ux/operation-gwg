import { Target } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { CreativeKpiBoardView } from "@/components/creative/kpi-board";

export const metadata: Metadata = { title: "KPI Social Media" };

/** Hanya Super Admin & Head departemen terkait yang boleh mengubah angkanya —
 *  anggota tim melihat KPI-nya, tapi tidak mengetik nilai yang menilai dirinya. */
const HEAD_DEPARTMENTS = ["Creative", "Marketing Communication"];

export default async function CreativeKpiPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "creative_kpi")) redirect("/dashboard");

  const canEdit =
    user.role === "super_admin" || (user.jabatan === "Head" && HEAD_DEPARTMENTS.includes(user.department ?? ""));

  return (
    <div className="w-full">
      <PageHeader
        icon={Target}
        title="KPI Social Media"
        description="Jumlah konten & ketepatan waktu dari Pengajuan Design, engagement & pertumbuhan dari Instagram"
      />
      <CreativeKpiBoardView canEdit={canEdit} />
    </div>
  );
}
