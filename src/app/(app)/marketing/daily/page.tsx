import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import { HalamanPerforma } from "@/components/operation/halaman-performa";
import type { MenuKey } from "@/lib/nav";

export const metadata: Metadata = { title: "Daily" };
export const maxDuration = 60;

export default async function MktDailyPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; tahun?: string; area?: string }>;
}) {
  return (
    <HalamanPerforma
      props={{
        skala: "harian",
        menu: "mkt_daily" as MenuKey,
        href: "/marketing/daily",
        ikon: CalendarDays,
        keterangan: "Net sales per hari",
      }}
      searchParams={searchParams}
    />
  );
}
