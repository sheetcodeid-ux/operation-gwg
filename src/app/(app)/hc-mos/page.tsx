import { Network, Table2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { ringkasHcmos } from "@/lib/data/hcmos";
import { BingkaiLaporan } from "@/components/hcmos/kit-modul";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HcmosDashboard } from "@/components/hcmos/hcmos-dashboard";

export const metadata: Metadata = { title: "HC-MOS — Human Capital" };

export default async function HcmosPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const ringkas = await ringkasHcmos(user);

  // Bingkainya membawa judul, panduan, dan layar penuh; kartunya tetap
  // dirender di server.
  return (
    <div className="flex w-full flex-col">
      <BingkaiLaporan
        ikon={Network}
        gradien="from-brand-500 via-indigo-500 to-violet-600 shadow-indigo-500/20"
        judul="HC-MOS"
        ringkas={"Human Capital Management Operating System — 9 pilar, dua scope: Manajemen & Outlet"}
        panduan="hcmos"
      >
        {/* Jalan pintas ke matriks tetap di dalam bingkai: ia bagian dari
            kerangka HC-MOS, bukan aksi atas isi halaman ini. */}
        <Link
          href="/hc-mos/raci"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mb-3")}
        >
          <Table2 className="size-4" /> Matriks RACI
        </Link>
        <HcmosDashboard ringkas={ringkas} />
      </BingkaiLaporan>
    </div>
  );
}
