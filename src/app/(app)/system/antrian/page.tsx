import { Headset } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { getUsers } from "@/lib/data/store";
import { listSystemRequests } from "@/lib/data/system";
import { isSystemSupport, timSystemSupport } from "@/lib/system-shared";
import { PageHeader } from "@/components/ui/page-header";
import { HelpdeskPanel } from "@/components/system/helpdesk-panel";

export const metadata: Metadata = { title: "Antrian System — System Support" };

export default async function SystemAntrianPage() {
  const user = await requireSessionUser();
  // Hanya tim System Support (dikenali dari jabatannya) atau Super Admin.
  if (!isSystemSupport(user)) redirect("/dashboard");

  const rows = await listSystemRequests("system");

  /**
   * Penanggung jawab yang bisa dipilih = SELURUH tim System Support.
   *
   * Dulu syaratnya departemen "Operational" DAN jabatan "System Support"
   * sekaligus. Tidak ada satu pun akun yang memenuhi keduanya — timnya
   * terdaftar di departemen "System Support" — sehingga daftarnya kosong dan
   * tiket yang sudah masuk sama sekali tidak bisa ditugaskan ke siapa pun.
   *
   * Yang dipakai sekarang keanggotaan TIM, bukan satu jabatan tertentu. Meja
   * ini dikerjakan bersama: yang berjabatan IT Help Desk pun ikut memegang
   * tiket POS, dan mengeluarkannya dari daftar hanya memaksa orang menugaskan
   * tiket ke nama yang salah.
   */
  const handlers = getUsers()
    .filter((u) => u.active && timSystemSupport(u))
    .map((u) => ({ id: u.id, name: u.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="w-full">
      <PageHeader
        icon={Headset}
        title="Antrian System"
        description="Tiket perangkat & POS dari cabang. Tinjau, tentukan penanggung jawab, lalu teruskan ke Work Tracker untuk dikerjakan."
      />
      <HelpdeskPanel rows={rows} handlers={handlers} canDelete={user.role === "super_admin"} />
    </div>
  );
}
