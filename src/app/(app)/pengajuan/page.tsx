import { FileUp, GraduationCap, MonitorCog, Palette, Send, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listHcRequests } from "@/lib/data/hc-requests";
import { isOpen } from "@/lib/hc-request";
import { PageHeader } from "@/components/ui/page-header";
import { HubCategories, HubSectionTitle, type HubCategory } from "@/components/hc/request-hub";
import { RecentRequests } from "@/components/hc/request-recent";

export const metadata: Metadata = { title: "Pengajuan" };

export default async function PengajuanPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_request")) redirect("/dashboard");

  const department = user.department ?? "—";
  const mine = await listHcRequests({ department });
  const openOf = (kind: "rekrutmen" | "pelatihan" | "design") =>
    mine.filter((r) => r.kind === kind && isOpen(r.status)).length;

  const categories: HubCategory[] = [
    {
      href: "/pengajuan/karyawan",
      icon: UserPlus,
      title: "Permintaan Karyawan",
      description: "Tambah pegawai baru atau pengganti — diproses Human Capital sampai kandidat diterima.",
      openCount: openOf("rekrutmen"),
    },
    {
      href: "/pengajuan/pelatihan",
      icon: GraduationCap,
      title: "Pengajuan Pelatihan",
      description: "Program pelatihan & pengembangan tim — ACC Human Capital, lalu Finance menyetujui dananya.",
      openCount: openOf("pelatihan"),
    },
    {
      href: "/pengajuan/design",
      icon: Palette,
      title: "Pengajuan Design",
      description: "Materi promosi, konten, dan cetakan — dikerjakan tim Creative setelah brief disetujui.",
      openCount: openOf("design"),
    },
  ];

  // Menu pengajuan lain yang sudah ada di aplikasi ikut ditampilkan di sini bila
  // pengguna memang berhak membukanya — supaya semua yang sifatnya "pengajuan"
  // berangkat dari satu halaman.
  if (canReachMenu(user, "hc_submit")) {
    categories.push({
      href: "/hc/pengajuan",
      icon: FileUp,
      title: "Pengajuan Dokumen",
      description: "BPJS, PKWT, surat teguran/SP, surat keterangan, dan dokumen kepegawaian lainnya.",
    });
  }
  if (canReachMenu(user, "sys_submit")) {
    categories.push({
      href: "/system/pengajuan",
      icon: MonitorCog,
      title: "Pengajuan System",
      description: "Kendala perangkat, akses aplikasi, dan permintaan bantuan tim System Support.",
    });
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={Send}
        title="Pengajuan"
        description={`Semua permintaan departemen ${department} berangkat dari sini.`}
      />

      <HubSectionTitle hint={`${categories.length} kategori`}>Kategori Pengajuan</HubSectionTitle>
      <HubCategories items={categories} />

      <HubSectionTitle hint={mine.length > 0 ? `${mine.length} total` : undefined}>
        Pengajuan Terakhir
      </HubSectionTitle>
      <RecentRequests rows={mine} />
    </div>
  );
}
