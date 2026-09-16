import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";
import { HalamanPerforma } from "@/components/operation/halaman-performa";
import type { MenuKey } from "@/lib/nav";

export const metadata: Metadata = { title: "Monthly" };
export const maxDuration = 60;

export default async function MktMonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; tahun?: string; area?: string }>;
}) {
  return (
    <HalamanPerforma
      props={{
        skala: "bulanan",
        menu: "mkt_monthly" as MenuKey,
        href: "/marketing/monthly",
        bidang: "Marketing V.1",
        ikon: CalendarCheck,
        keterangan: "Net sales per bulan",
      }}
      searchParams={searchParams}
    />
  );
}
