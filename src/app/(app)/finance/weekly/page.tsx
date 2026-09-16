import { CalendarRange } from "lucide-react";
import type { Metadata } from "next";
import { HalamanPerforma } from "@/components/operation/halaman-performa";
import type { MenuKey } from "@/lib/nav";

export const metadata: Metadata = { title: "Weekly" };
export const maxDuration = 60;

export default async function FinWeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; tahun?: string; area?: string }>;
}) {
  return (
    <HalamanPerforma
      props={{
        skala: "mingguan",
        menu: "fin_weekly" as MenuKey,
        href: "/finance/weekly",
        bidang: "Finance V.1",
        ikon: CalendarRange,
        keterangan: "Net sales per minggu",
      }}
      searchParams={searchParams}
    />
  );
}
