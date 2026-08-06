import { GraduationCap } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getUsers } from "@/lib/data/store";
import { listHcRequests } from "@/lib/data/hc-requests";
import { PageHeader } from "@/components/ui/page-header";
import { HcRequestList, NewRequestButton } from "@/components/hc/request-submit";

export const metadata: Metadata = { title: "Pengajuan Pelatihan" };

export default async function PengajuanPelatihanPage() {
  const user = (await getSessionUser())!;
  if (!canReachMenu(user, "hc_request")) redirect("/dashboard");

  const department = user.department ?? "—";
  const rows = await listHcRequests({ department, kind: "pelatihan" });

  // Kandidat peserta = anggota aktif departemen pemohon, sesuai User Management.
  // Akun tanpa departemen (mis. Super Admin) melihat seluruh karyawan aktif —
  // kalau tidak, daftar pesertanya kosong dan nama tidak bisa dipilih sama sekali.
  const active = getUsers().filter((u) => u.active);
  const scoped = department && department !== "—" ? active.filter((u) => u.department === department) : active;
  const members = (scoped.length > 0 ? scoped : active)
    .map((u) => ({ id: u.id, name: u.name, jabatan: u.jabatan ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));

  return (
    <div className="w-full">
      <PageHeader
        icon={GraduationCap}
        title="Pengajuan Pelatihan"
        description="Ajukan program pelatihan ke Human Capital. Setelah disetujui, Finance memutuskan dananya."
        actions={<NewRequestButton kind="pelatihan" members={members} />}
      />
      <HcRequestList rows={rows} kind="pelatihan" />
    </div>
  );
}
