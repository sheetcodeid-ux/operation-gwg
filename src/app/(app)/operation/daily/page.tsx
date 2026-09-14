import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { harianOutlet } from "@/lib/data/daily-outlet";
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
 * CAKUPANNYA DIBATASI DI SERVER. Coordinator Area melihat outlet yang
 * ditugaskan kepadanya saja; super admin dan kepala operasional melihat
 * seluruhnya. Batasnya di sini, bukan di komponen: baris yang hanya disaring
 * di layar tetap ikut terkirim ke peramban, dan siapa pun bisa membacanya dari
 * sana.
 */
export default async function DailyPage({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, MENU)) redirect("/dashboard");

  const sp = await searchParams;
  const periode = /^\d{4}-\d{2}$/.test(sp.bulan ?? "") ? sp.bulan! : bulanIni();

  // Penugasannya dari `users.outlet_ids` — sumber yang sama dengan KPI
  // Coordinator Area, supaya daftar outletnya tidak pernah berbeda antara
  // halaman ini dan rapornya sendiri.
  const sendiri = user.role === "area_coordinator";
  const detail = await harianOutlet(periode, sendiri ? [...outletMilikPic(user.id)] : undefined);

  return (
    <div className="w-full">
      <PageHeader
        icon={CalendarDays}
        title="Daily"
        description={
          sendiri
            ? "Net sales harian outlet yang Anda pegang — dari ESB"
            : "Net sales harian per outlet — dari ESB"
        }
      />
      <TabelHarian detail={detail} />
    </div>
  );
}
