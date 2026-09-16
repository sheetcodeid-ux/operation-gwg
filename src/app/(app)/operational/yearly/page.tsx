import { TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { HalamanPerforma } from "@/components/operation/halaman-performa";
import type { MenuKey } from "@/lib/nav";

export const metadata: Metadata = { title: "Yearly" };
export const maxDuration = 60;

export default async function YearlyPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; tahun?: string; area?: string }>;
}) {
  return (
    <HalamanPerforma
      props={{
        skala: "tahunan",
        menu: "op_yearly" as MenuKey,
        href: "/operational/yearly",
        ikon: TrendingUp,
        keterangan: "Net sales per tahun",
      }}
      searchParams={searchParams}
    />
  );
}
