import { ArrowLeft, MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getOutlets } from "@/lib/data/store";
import { scopeOutlets } from "@/lib/rbac";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { RelasiBoard } from "@/components/hcmos/modul-boards";
import { Badge } from "@/components/ui/badge";
import { bolehUbahHc } from "@/lib/hcmos/akses";

export const metadata: Metadata = { title: "Hubungan Industrial — HC-MOS" };

export default async function RelasiPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const sp = await searchParams;
  const tab = sp.tab === "keluar" ? "keluar" : "kasus";

  // Kasus hubungan industrial menyangkut nama orang beserta perkaranya —
  // dibaca terbatas, bukan konsumsi umum.
  if (!bolehUbahHc(user)) {
    return (
      <div className="w-full">
        <PageHeader icon={MessageSquare} title="Employee & Industrial Relations" description="Penanganan kasus dan proses keluar karyawan." />
        <EmptyState
          icon={MessageSquare}
          title="Halaman ini khusus Human Capital"
          description="Berisi perkara kepegawaian yang menyebut nama karyawan."
        />
      </div>
    );
  }

  const semua = await listTabel("hc_cases");
  const outlets = scopeOutlets(user, getOutlets()).map((o) => ({ id: o.id, name: o.name }));

  return (
    <div className="w-full">
      <Link href="/hc-mos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>
      <PageHeader
        icon={MessageSquare}
        title={tab === "keluar" ? "Offboarding / Exit Process" : "Case Management"}
        description={
          tab === "keluar"
            ? "Proses karyawan keluar (resign atau PHK) — dari notifikasi sampai statusnya non-aktif di Database Karyawan."
            : "Penanganan kasus hubungan industrial — pilih tampilan sesuai scope: Manajemen (GWG) atau Outlet."
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="neutral">Employee &amp; Industrial Relations</Badge>
        <Badge tone="neutral">PIC: {tab === "keluar" ? "Adrian & Uswatun" : "Adrian"}</Badge>
        <Badge tone="neutral">Scope: Manajemen &amp; Outlet</Badge>
      </div>
      <RelasiBoard
        kasus={semua.filter((r) => r.jenis === "kasus")}
        keluar={semua.filter((r) => r.jenis === "offboarding")}
        outlets={outlets}
        bolehUbah
        tabAwal={tab}
      />
    </div>
  );
}
