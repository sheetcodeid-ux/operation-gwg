import { Waves } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canOpenMenu } from "@/lib/nav";
import { getSeasonal, getSeasonalBranches } from "@/lib/data/seasonal";
import { PageHeader } from "@/components/ui/page-header";
import { SeasonalChart } from "@/components/operation/seasonal-chart";

export const metadata: Metadata = { title: "Musiman — Penjualan" };
// The POS is polled per day when a year isn't fully cached — allow room.
export const maxDuration = 60;

export default async function MusimanPage() {
  const user = (await getSessionUser())!;
  if (!canOpenMenu(user.role, "op_seasonal", user.grants)) redirect("/dashboard");

  const year = new Date(Date.now() + 7 * 3_600_000).getUTCFullYear();
  const years = [year, year - 1, year - 2];
  const [initial, outlets] = await Promise.all([getSeasonal(year, ""), getSeasonalBranches()]);

  return (
    <div className="w-full">
      <PageHeader
        className="mb-3"
        icon={Waves}
        title="Musiman — Pola Penjualan"
        description="Bandingkan pola penjualan harian antar bulan (gross & net) dari data POS — seperti seasonality TradingView."
      />
      <SeasonalChart initial={initial} initialYear={year} years={years} outlets={outlets} />
    </div>
  );
}
