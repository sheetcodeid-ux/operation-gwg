import { Palette } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { kelolaAntrianDesign } from "@/lib/hc-request";
import { getUsers } from "@/lib/data/store";
import { PageHeader } from "@/components/ui/page-header";
import { HcRequestReview } from "@/components/hc/request-review";

export const metadata: Metadata = { title: "Antrian Design" };

export default async function CreativeDesignQueuePage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "creative_design")) redirect("/dashboard");

  // Kandidat PIC = anggota aktif tim Creative. Akun tanpa departemen (mis. Super
  // Admin) melihat seluruh karyawan aktif — kalau tidak, daftar PIC-nya kosong
  // dan permintaan tidak bisa ditugaskan sama sekali.
  const active = getUsers().filter((u) => u.active);
  const creative = active.filter((u) => u.department === "Creative");
  const picOptions = (creative.length > 0 ? creative : active)
    .map((u) => ({ id: u.id, name: u.name, jabatan: u.jabatan ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));

  // Yang mengelola antrian membagi pekerjaan; yang mengerjakan hanya menerima
  // kolam bersama + miliknya sendiri. Pembatasannya sendiri dilakukan di server
  // (`allHcRequestsAction`); di sini hanya menentukan tampilannya.
  const kelola = kelolaAntrianDesign(user);

  return (
    <div className="w-full">
      <PageHeader
        icon={Palette}
        title="Antrian Design"
        description={
          kelola
            ? "Permintaan materi desain dari seluruh departemen. Tugaskan PIC-nya, lalu tandai selesai beserta hasilnya."
            : "Tab Menunggu berisi permintaan baru seluruh tim; tab lainnya hanya pekerjaan Anda sendiri. Ambil dari Menunggu untuk mulai mengerjakan, lalu tandai selesai beserta hasilnya."
        }
      />
      <HcRequestReview mode="hc" kind="design" picOptions={picOptions} kelola={kelola} meId={user.id} />
    </div>
  );
}
