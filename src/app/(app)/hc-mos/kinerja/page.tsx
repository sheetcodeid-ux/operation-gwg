import { ArrowLeft, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getOutlets } from "@/lib/data/store";
import { scopeOutlets } from "@/lib/rbac";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { PageHeader } from "@/components/ui/page-header";
import { KinerjaBoard } from "@/components/hcmos/kinerja-board";
import { Badge } from "@/components/ui/badge";
import { bolehUbahHc } from "@/lib/hcmos/akses";

export const metadata: Metadata = { title: "Kinerja & Kompetensi — HC-MOS" };

export default async function KinerjaPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const sp = await searchParams;
  const [penilaian, kompetensi, intervensi] = await Promise.all([
    listTabel("hc_reviews"),
    listTabel("hc_competency"),
    listTabel("hc_interventions"),
  ]);
  const outlets = scopeOutlets(user, getOutlets()).map((o) => ({ id: o.id, name: o.name }));

  return (
    <div className="w-full">
      <Link href="/hc-mos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>
      <PageHeader
        icon={Target}
        title="Kinerja & Kompetensi"
        description="Penilaian kinerja, permintaan intervensi saat kinerja turun, dan pemetaan kompetensi terhadap standar jabatan."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="neutral">{sp.tab === "kompetensi" ? "Learning & Development" : "Performance Management"}</Badge>
        <Badge tone="neutral">PIC: Riva</Badge>
        <Badge tone="neutral">Scope: Manajemen &amp; Outlet</Badge>
      </div>

      <KinerjaBoard
        penilaian={penilaian}
        kompetensi={kompetensi}
        intervensi={intervensi}
        outlets={outlets}
        bolehUbah={bolehUbahHc(user)}
        tabAwal={sp.tab === "intervensi" || sp.tab === "kompetensi" ? sp.tab : "penilaian"}
      />
    </div>
  );
}
