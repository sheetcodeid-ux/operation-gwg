import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { daftarArea, harianOutlet } from "@/lib/data/daily-outlet";
import { outletMilikPic } from "@/lib/data/kpi";
import { PageHeader } from "@/components/ui/page-header";
import { TabelHarian } from "@/components/operation/tabel-harian";

export const metadata: Metadata = { title: "Daily" };

const MENU = "op_daily" as MenuKey;

/** Bulan berjalan WIB — Daily membaca hari ini, bukan bulan penilaian KPI. */
function bulanIni(): string {
  return new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 7);
}

/**
 * Daily — penjualan hari demi hari per outlet.
 *
 * CAKUPANNYA DIBATASI DI SERVER. Coordinator Area hanya melihat outlet yang
 * ditugaskan kepadanya dan tidak bisa memilih area lain, apa pun yang dikirim
 * peramban; yang lain boleh memilih lewat dropdown, bawaannya seluruh outlet.
 *
 * Batasnya di sini, bukan di komponen: baris yang hanya disaring di layar tetap
 * ikut terkirim ke peramban, dan siapa pun bisa membacanya dari sana.
 */
export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; area?: string }>;
}) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, MENU)) redirect("/dashboard");

  const sp = await searchParams;
  const periode = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? sp.bulan! : bulanIni();

  const area = daftarArea();
  const terkunci = user.role === "area_coordinator";
  // Coordinator Area SELALU areanya sendiri — `?area=` dari peramban diabaikan.
  const dipilih = terkunci ? user.id : (area.some((a) => a.value === sp.area) ? sp.area! : "");

  const detail = await harianOutlet(periode, dipilih ? [...outletMilikPic(dipilih)] : undefined);
  const nama = area.find((a) => a.value === dipilih)?.label;

  return (
    <div className="w-full">
      <PageHeader
        icon={CalendarDays}
        title="Daily"
        description={
          terkunci
            ? "Net sales harian outlet yang Anda pegang — dari ESB"
            : nama
              ? `Net sales harian outlet area ${nama} — dari ESB`
              : "Net sales harian per outlet — dari ESB"
        }
      />
      <TabelHarian detail={detail} area={area} areaTerpilih={dipilih} bisaPilihArea={!terkunci} />
    </div>
  );
}
