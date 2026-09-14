import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { PapanSupervisor } from "@/components/kpi/papan-supervisor";
import { periodeSekarang } from "@/lib/data/kpi";
import { rekapSupervisor } from "@/lib/data/supervisor";

export const metadata: Metadata = { title: "KPI Supervisor" };
export const dynamic = "force-dynamic";
/** Lima puluh tiga rapor dalam satu permintaan. Dengan memo per-permintaan di
 *  pembaca bulanannya ini cepat, tapi batas bawaan rute tetap terlalu ketat
 *  untuk bulan yang datanya belum sempat dibaca sekali pun. */
export const maxDuration = 60;

/**
 * KPI Supervisor — di luar manajemen, berdiri sendiri.
 *
 * SIAPA MELIHAT APA ditentukan di sini, bukan di komponennya. Yang berperan
 * supervisor hanya melihat barisnya sendiri; baris yang disaring di layar
 * tetap terkirim ke peramban, dan siapa pun bisa membacanya dari sana.
 */
export default async function KpiSupervisorPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string }>;
}) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "kpi_supervisor")) redirect("/dashboard");

  const sp = await searchParams;
  const periode = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? sp.bulan! : periodeSekarang();

  const sendiri = user.role === "supervisor";
  const rekap = await rekapSupervisor(periode, sendiri ? user.id : undefined);

  return (
    <div className="w-full">
      <PageHeader title={sendiri ? "KPI Saya" : "KPI Supervisor"} />
      <PapanSupervisor rekap={rekap} bisaLihatSemua={!sendiri} />
    </div>
  );
}
