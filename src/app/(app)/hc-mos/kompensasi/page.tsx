import { ArrowLeft, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getOutlets, getUsers } from "@/lib/data/store";
import { scopeOutlets } from "@/lib/rbac";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { listKontrak } from "@/lib/data/hcmos";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { KompensasiBoard } from "@/components/hcmos/kompensasi-board";
import { bolehUbahHc } from "@/lib/hcmos/akses";
import type { HcScope } from "@/lib/hcmos/pillars";

export const metadata: Metadata = { title: "Compensation & Benefit — HC-MOS" };

const TAB_SAH = ["cuti", "payroll", "bpjs", "golongan"];

/** Satu halaman melayani empat menu sidebar; judulnya ikut menu yang membukanya
 *  supaya orang tidak merasa mendarat di tempat lain dari yang ia klik. */
const JUDUL: Record<string, string> = {
  cuti: "Attendance & Cuti",
  payroll: "Payroll",
  bpjs: "BPJS & Benefit",
  golongan: "Struktur Kompensasi",
};

const URAIAN: Record<string, string> = {
  cuti: "Rekap kehadiran & pengajuan cuti/izin — pilih tampilan sesuai scope: Manajemen (GWG) atau Outlet.",
  payroll: "Pengelolaan penggajian bulanan — pilih tampilan sesuai scope: Manajemen (GWG) atau Outlet.",
  bpjs: "Administrasi BPJS Ketenagakerjaan & Kesehatan, serta program benefit lain di luar BPJS.",
  golongan: "Struktur kompensasi per golongan jabatan untuk manajemen dan crew outlet.",
};

export default async function KompensasiPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hcmos")) redirect("/dashboard");

  const sp = await searchParams;
  const tab = TAB_SAH.includes(sp.tab ?? "") ? sp.tab! : "cuti";

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

  const [cuti, payroll, benefit, program, golongan] = await Promise.all([
    listTabel("hc_leaves"),
    listTabel("hc_payroll"),
    listTabel("hc_benefits"),
    listTabel("hc_benefit_programs"),
    listTabel("hc_salary_grades"),
  ]);
  const outlets = scopeOutlets(user, getOutlets()).map((o) => ({ id: o.id, name: o.name }));

  // Penyebut kehadiran datang dari luar tabel cuti — User Management tahu siapa
  // staf manajemen yang aktif, Kontrak Tracker tahu siapa crew outlet yang
  // kontraknya berjalan. Kalau penyebutnya diambil dari `hc_leaves`, hari tanpa
  // satu pun pengajuan akan terbaca 0% padahal artinya justru semua masuk.
  const kontrak = await listKontrak(user);
  const jumlahKaryawan: Record<HcScope, number> = {
    manajemen: getUsers().filter((u) => u.active).length,
    outlet: kontrak.filter((k) => !k.tglResign).length,
  };

  return (
    <div className="w-full">
      <Link href="/hc-mos" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>
      <PageHeader icon={Wallet} title={JUDUL[tab]} description={URAIAN[tab]} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="neutral">Compensation &amp; Benefit</Badge>
        <Badge tone="neutral">PIC: Uswatun</Badge>
        <Badge tone="neutral">Scope: Manajemen &amp; Outlet</Badge>
      </div>
      <KompensasiBoard
        cuti={cuti}
        payroll={payroll}
        benefit={benefit}
        program={program}
        golongan={golongan}
        outlets={outlets}
        jumlahKaryawan={jumlahKaryawan}
        hariIniIso={new Date().toISOString().slice(0, 10)}
        bolehUbah
        tabAwal={tab}
      />
    </div>
  );
}
