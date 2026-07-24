import { FileUp } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { visibleOutlets } from "@/lib/data/store";
import { listHcSubmissions } from "@/lib/data/hc";
import { PageHeader } from "@/components/ui/page-header";
import { NewSubmissionButton, SubmissionList } from "@/components/hc/hc-submit";

export const metadata: Metadata = { title: "Pengajuan Dokumen" };

export default async function HcPengajuanPage() {
  const user = (await getSessionUser())!;
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
        actions={<NewSubmissionButton outlets={outlets} />}
      />
      <SubmissionList rows={rows} />
    </div>
  );
}
