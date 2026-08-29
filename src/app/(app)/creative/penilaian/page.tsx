import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { dashboardPenilaian } from "@/lib/data/creative-penilaian";
import { PenilaianBoard } from "@/components/creative/penilaian-board";

export const metadata: Metadata = { title: "Penilaian Request Design" };

/**
 * Dashboard penilaian terhadap YANG MEMINTA design.
 *
 * Aksesnya mengikuti menunya sendiri, bukan menu Antrian Design: yang perlu
 * membacanya bukan hanya tim Creative, melainkan juga yang mengevaluasi
 * Coordinator Area. Sebaliknya seorang designer tidak perlu — dan sebaiknya
 * tidak — melihat rapor cabang setiap hari.
 */
export default async function PenilaianRequestPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "creative_penilaian")) redirect("/dashboard");

  const data = await dashboardPenilaian();

  return (
    <div className="flex w-full flex-col">
      <PenilaianBoard data={data} />
    </div>
  );
}
