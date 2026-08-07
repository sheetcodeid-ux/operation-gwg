import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listHcRequests } from "@/lib/data/hc-requests";
import { PageHeader } from "@/components/ui/page-header";
import { HcRequestList, NewRequestButton } from "@/components/hc/request-submit";

export const metadata: Metadata = { title: "Permintaan Karyawan" };

export default async function PermintaanKaryawanPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_request")) redirect("/dashboard");

  const rows = await listHcRequests({ department: user.department ?? "—", kind: "rekrutmen" });

  return (
    <div className="w-full">
      <PageHeader
        icon={UserPlus}
        title="Permintaan Karyawan"
        description="Ajukan penambahan atau pengganti pegawai ke tim Human Capital. Status persetujuan terlihat di setiap kartu."
        actions={<NewRequestButton kind="rekrutmen" />}
      />
      <HcRequestList rows={rows} kind="rekrutmen" />
    </div>
  );
}
