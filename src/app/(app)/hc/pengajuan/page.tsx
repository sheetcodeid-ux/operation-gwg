import { FileUp } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { visibleOutlets } from "@/lib/data/store";
import { listHcSubmissions } from "@/lib/data/hc";
import { PageHeader } from "@/components/ui/page-header";
import { PanduanModul } from "@/components/hcmos/panduan-modul";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { NewSubmissionButton, SubmissionList } from "@/components/hc/hc-submit";

export const metadata: Metadata = { title: "Pengajuan Dokumen" };

export default async function HcPengajuanPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_submit")) redirect("/dashboard");

  const outlets = visibleOutlets(user).map((o) => ({ id: o.id, name: o.name }));
  // Supervisors see only their own submissions; Admin (oversight) sees all.
  // The list doesn't render the KTP, so skip signing it (faster load).
  const rows = await listHcSubmissions({ supervisorId: user.role === "super_admin" ? undefined : user.id, withKtp: false });

  return (
    <div className="w-full">
      <PageHeader
        icon={FileUp}
        title="Pengajuan Dokumen Karyawan"
        description="Ajukan dokumen karyawan (BPJS, PKWT, Surat Teguran) ke tim Human Capital. Unduh hasil setelah berstatus Selesai."
        actions={
          <>
            <PanduanModul panduan="hc_pengajuan" />
      <KonteksModul panduan="hc_pengajuan" />
            <NewSubmissionButton outlets={outlets} />
          </>
        }
      />
      <SubmissionList rows={rows} />
    </div>
  );
}
