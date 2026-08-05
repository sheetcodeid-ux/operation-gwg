import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getUsers } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/page-header";
import { HcRequestBoard } from "@/components/hc/request-submit";

export const metadata: Metadata = { title: "Pengajuan Pelatihan" };

export default async function PengajuanPelatihanPage() {
  const user = (await getSessionUser())!;
  if (!canReachMenu(user, "hc_request")) redirect("/dashboard");

  // Kandidat peserta = anggota aktif departemen pemohon, sesuai User Management.
  const department = user.department ?? "";
  const members = getUsers()
    .filter((u) => u.active && u.department === department)
    .map((u) => ({ id: u.id, name: u.name, jabatan: u.jabatan ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));

  return (
    <div className="w-full">
      <PageHeader
        icon={GraduationCap}
        title="Pengajuan Pelatihan"
        description="ACC Human Capital, lalu Finance menyetujui dananya sebelum pelatihan dijalankan."
      />
      <HcRequestBoard kind="pelatihan" members={members} />
    </div>
  );
}
