import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { HcRequestBoard } from "@/components/hc/request-submit";

export const metadata: Metadata = { title: "Permintaan Karyawan" };

export default async function PermintaanKaryawanPage() {
  const user = (await getSessionUser())!;
  if (!canReachMenu(user, "hc_request")) redirect("/dashboard");
  return (
    <div className="w-full">
      <PageHeader
        icon={UserPlus}
        title="Permintaan Karyawan"
        description={`Penambahan & pengganti pegawai departemen ${user.department ?? "Anda"} — diproses Human Capital.`}
      />
      <HcRequestBoard kind="rekrutmen" />
    </div>
  );
}
