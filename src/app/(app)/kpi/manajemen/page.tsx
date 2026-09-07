import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { bolehAturKpi } from "@/lib/kpi/akses";
import { periodeSekarang } from "@/lib/data/kpi";
import { detailManajemen } from "@/lib/data/kpi-manajemen";
import { PageHeader } from "@/components/ui/page-header";
import { PapanManajemen } from "@/components/kpi/papan-manajemen";

export const metadata: Metadata = { title: "KPI Manajemen" };

/**
 * Kalkulator KPI Manajemen — skor perusahaan pada satu bulan.
 *
 * Berdiri terpisah dari `/kpi/[posisi]` karena yang dinilai bukan orang
 * melainkan perusahaan: tidak ada PIC, tidak ada indikator per posisi, dan
 * bobotnya ditetapkan kebijakan korporat, bukan pengaturan per posisi.
 */
export default async function KpiManajemenPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "kpi_manajemen" as MenuKey)) redirect("/dashboard");

  const { periode } = await searchParams;
  // Periode dari alamat hanya diterima bila bentuknya benar — "?periode=besok"
  // akan menghasilkan kueri tanggal yang tidak masuk akal dan halaman kosong
  // yang tidak bisa dijelaskan.
  const dipakai = periode && /^\d{4}-\d{2}$/.test(periode) ? periode : periodeSekarang();
  const detail = await detailManajemen(dipakai);

  return (
    <div className="w-full">
      <PageHeader title="KPI Manajemen" />
      <PapanManajemen detail={detail} bolehAtur={bolehAturKpi(user)} />
    </div>
  );
}
