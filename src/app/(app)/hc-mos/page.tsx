import { Network, Table2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { ringkasHcmos } from "@/lib/data/hcmos";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { HcmosDashboard } from "@/components/hcmos/hcmos-dashboard";

export const metadata: Metadata = { title: "HC-MOS — Human Capital" };

export default async function HcmosPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const ringkas = await ringkasHcmos(user);

  return (
    <div className="w-full">
      <PageHeader
        icon={Network}
        title="HC-MOS"
        description="Human Capital Management Operating System — 9 pilar, dua scope: Manajemen & Outlet."
        actions={
          <Link href="/hc-mos/raci" className={buttonVariants({ variant: "secondary" })}>
            <Table2 className="size-4" /> Matriks RACI
          </Link>
        }
      />
      <HcmosDashboard ringkas={ringkas} />
    </div>
  );
}
