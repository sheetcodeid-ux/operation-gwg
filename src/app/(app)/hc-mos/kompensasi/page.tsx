import { ArrowLeft, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getOutlets } from "@/lib/data/store";
import { scopeOutlets } from "@/lib/rbac";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { KompensasiBoard } from "@/components/hcmos/modul-boards";
import { bolehUbahHc } from "@/lib/hcmos/akses";

export const metadata: Metadata = { title: "Compensation & Benefit — HC-MOS" };

const TAB_SAH = ["cuti", "payroll", "bpjs", "golongan"];

export default async function KompensasiPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const sp = await searchParams;

  // Payroll memuat gaji orang per orang. Dibiarkan terbuka untuk semua yang
  // bisa membuka HC-MOS, satu halaman ini akan membocorkan seluruh struktur
  // gaji perusahaan — jadi aksesnya dibatasi Human Capital.
  if (!bolehUbahHc(user)) {
    return (
      <div className="w-full">
        <PageHeader icon={Wallet} title="Compensation & Benefit" description="Kehadiran, payroll, BPJS, dan struktur kompensasi." />
        <EmptyState
          icon={Wallet}
          title="Halaman ini khusus Human Capital"
          description="Berisi gaji per karyawan dan struktur kompensasi perusahaan."
        />
      </div>
    );
  }

  const [cuti, payroll, benefit, golongan] = await Promise.all([
    listTabel("hc_leaves"),
    listTabel("hc_payroll"),
    listTabel("hc_benefits"),
    listTabel("hc_salary_grades"),
  ]);
  const outlets = scopeOutlets(user, getOutlets()).map((o) => ({ id: o.id, name: o.name }));

  return (
    <div className="w-full">
      <Link href="/hc-mos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>
      <PageHeader
        icon={Wallet}
        title="Compensation & Benefit"
        description="Kehadiran & cuti, payroll bulanan, kepesertaan BPJS, dan struktur kompensasi per golongan."
      />
      <KompensasiBoard
        cuti={cuti}
        payroll={payroll}
        benefit={benefit}
        golongan={golongan}
        outlets={outlets}
        bolehUbah
        tabAwal={TAB_SAH.includes(sp.tab ?? "") ? sp.tab! : "cuti"}
      />
    </div>
  );
}
