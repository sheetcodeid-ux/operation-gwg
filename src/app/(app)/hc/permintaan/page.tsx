import { CheckCircle2, ClipboardCheck, ClipboardList, Store, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { PanduanModul } from "@/components/hcmos/panduan-modul";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { HcRequestReview } from "@/components/hc/request-review";
import { StatTile } from "@/components/ui/stat";
import { listHcRequests } from "@/lib/data/hc-requests";

export const metadata: Metadata = { title: "Permintaan Karyawan" };

export default async function HcRecruitReviewPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_reqreview")) redirect("/dashboard");

  // Ringkasan dihitung di server dari daftar yang sama dengan antreannya,
  // supaya angka di kartu tidak pernah bisa berbeda dari isi daftarnya.
  const semua = await listHcRequests({ kind: "rekrutmen" });
  const berjalan = semua.filter((r) => r.status === "menunggu_hc" || r.status === "disetujui_hc");
  const bulanIni = new Date().toISOString().slice(0, 7);
  const terpenuhi = semua.filter((r) => r.status === "terlaksana" && (r.completedAt ?? "").startsWith(bulanIni));
  const orang = (rows: typeof semua) => rows.reduce((a, r) => a + (r.headcount || 1), 0);
  return (
    <div className="w-full">
      <PageHeader
        icon={ClipboardCheck}
        title="Permintaan Karyawan"
        description="Tinjau permintaan pegawai — dipisah Manajemen (divisi kantor) dan Outlet (cabang, diajukan Supervisor)."
        actions={<PanduanModul panduan="hc_permintaan" />}
      />
      <KonteksModul panduan="hc_permintaan" />

      <div className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={ClipboardList} label="Request Berjalan" value={berjalan.length} sub={`${orang(berjalan)} orang diminta`} />
        <StatTile
          icon={UserPlus}
          label="Manajemen"
          value={berjalan.filter((r) => r.scope === "manajemen").length}
          sub="permintaan divisi kantor"
        />
        <StatTile
          icon={Store}
          label="Outlet"
          value={berjalan.filter((r) => r.scope === "outlet").length}
          sub="permintaan cabang"
        />
        <StatTile
          icon={CheckCircle2}
          label="Terpenuhi Bulan Ini"
          value={terpenuhi.reduce((a, r) => a + (r.recruited || 0), 0)}
          sub={`dari ${terpenuhi.length} permintaan`}
        />
      </div>

      <HcRequestReview mode="hc" kind="rekrutmen" />
    </div>
  );
}
