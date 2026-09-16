import { ChartColumnBig } from "lucide-react";
import type { Metadata } from "next";
import { HalamanPerforma } from "@/components/operation/halaman-performa";
import type { MenuKey } from "@/lib/nav";

export const metadata: Metadata = { title: "Quarterly" };
export const maxDuration = 60;

export default async function FinQuarterlyPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; tahun?: string; area?: string }>;
}) {
  return (
    <HalamanPerforma
      props={{
        skala: "kuartalan",
        menu: "fin_quarterly" as MenuKey,
        href: "/finance/quarterly",
        ikon: ChartColumnBig,
        keterangan: "Net sales per kuartal",
      }}
      searchParams={searchParams}
    />
  );
}
