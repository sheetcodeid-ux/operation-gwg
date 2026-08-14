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
import { bolehUbahHc } from "@/lib/hcmos/akses";

export const metadata: Metadata = { title: "Hubungan Industrial — HC-MOS" };

export default async function RelasiPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const sp = await searchParams;

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
        title="Employee & Industrial Relations"
        description="Penanganan kasus hubungan industrial dan proses keluar karyawan."
      />
      <RelasiBoard
        kasus={semua.filter((r) => r.jenis === "kasus")}
        keluar={semua.filter((r) => r.jenis === "offboarding")}
        outlets={outlets}
        bolehUbah
        tabAwal={sp.tab === "keluar" ? "keluar" : "kasus"}
      />
    </div>
  );
}
