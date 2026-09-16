import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";
import { HalamanPerforma } from "@/components/operation/halaman-performa";
import type { MenuKey } from "@/lib/nav";

export const metadata: Metadata = { title: "Monthly" };
export const maxDuration = 60;

export default async function FinMonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; tahun?: string; area?: string }>;
}) {
  return (
    <HalamanPerforma
      props={{
        skala: "bulanan",
        menu: "fin_monthly" as MenuKey,
        href: "/finance/monthly",
        ikon: CalendarCheck,
        keterangan: "Net sales per bulan",
      }}
      searchParams={searchParams}
    />
  );
}
