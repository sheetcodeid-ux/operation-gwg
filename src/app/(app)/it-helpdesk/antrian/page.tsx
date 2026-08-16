import { LifeBuoy } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { getUsers } from "@/lib/data/store";
import { listSystemRequests } from "@/lib/data/system";
import { HELPDESK_JABATAN, isHelpdeskOwner } from "@/lib/system-shared";
import { PageHeader } from "@/components/ui/page-header";
import { HelpdeskPanel } from "@/components/system/helpdesk-panel";

export const metadata: Metadata = { title: "Antrian IT Help Desk" };

export default async function ItHelpdeskAntrianPage() {
  const user = await requireSessionUser();
  if (!isHelpdeskOwner(user)) redirect("/dashboard");

  const rows = await listSystemRequests("helpdesk");

  /**
   * Daftar penanggung jawab yang bisa dipilih.
   *
   * Sengaja TIDAK memakai tim System Support: mereka mengurus perangkat di
   * cabang, bukan aplikasi ini. Menawarkan nama mereka membuat tiket web mudah
   * ditugaskan ke orang yang tidak akan mengerjakannya, lalu diam di situ.
   *
   * Kalau belum ada siapa pun berjabatan IT Help Desk, pemegang antrean ini
   * sendiri yang ditawarkan — daftar kosong berarti tiket sama sekali tidak
   * bisa diproses.
   */
  const pemegang = getUsers()
    .filter((u) => u.active && (u.jabatan ?? "").trim().toLowerCase() === HELPDESK_JABATAN.toLowerCase())
    .map((u) => ({ id: u.id, name: u.name }));
  const handlers = (pemegang.length > 0 ? pemegang : [{ id: user.id, name: user.name }]).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="w-full">
      <PageHeader
        icon={LifeBuoy}
        title="Antrian IT Help Desk"
        description="Tiket aplikasi dari seluruh departemen, terpusat di sini. Tinjau, tentukan penanggung jawab, lalu teruskan ke Work Tracker untuk dikerjakan."
      />
      <HelpdeskPanel rows={rows} handlers={handlers} canDelete={user.role === "super_admin"} />
    </div>
  );
}
