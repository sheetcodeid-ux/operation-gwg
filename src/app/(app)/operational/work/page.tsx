import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { daftarWork, saringStatus } from "@/lib/data/work-daftar";
import { canReachMenu, MENU_WORK } from "@/lib/nav";
import { PageHeader } from "@/components/ui/page-header";
import { PapanWorkUI } from "@/components/operation/papan-work";

export const metadata: Metadata = { title: "Work" };
export const maxDuration = 60;

/**
 * WORK Z-02 — daftar pekerjaan yang lahir dari Signal.
 *
 * ┌─ SATU GERBANG, DAN SATU JALAN SAMPING ───────────────────────────────────┐
 * │                                                                          │
 * │   canReachMenu(MENU_WORK)   melihat SELURUH Work perusahaan              │
 * │   pelaksana aktif           melihat Work yang dipegangnya, walau tidak   │
 * │                             boleh membuka menunya                        │
 * │                                                                          │
 * │ Itu bunyi O-06 apa adanya, dikunci ulang sebagai OD-01 = A. `persempit()`│
 * │ TIDAK dipakai: `works` tidak punya `outlet_id`, dan satu Work bisa       │
 * │ menangani Signal dari beberapa outlet sekaligus.                         │
 * │                                                                          │
 * │ Karena itu halaman ini TIDAK menolak siapa pun di pintu masuk — yang     │
 * │ tidak punya akses menu tetap boleh masuk dan melihat PEKERJAANNYA        │
 * │ SENDIRI. Yang membatasi `seluruhnya`, bukan redirect.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; overdue?: string; owner?: string; departemen?: string; pelaksana?: string }>;
}) {
  const user = await requireSessionUser();
  const seluruhnya = canReachMenu(user, MENU_WORK);

  const sp = await searchParams;
  const status = saringStatus((sp.status ?? "").split(",").filter(Boolean));

  const papan = await daftarWork({
    seluruhnya,
    userId: user.id,
    saring: {
      status,
      overdue: sp.overdue === "1",
      ownerId: sp.owner || null,
      departemen: sp.departemen || null,
      executorId: sp.pelaksana || null,
    },
  });

  // Tanpa akses menu DAN tanpa satu pun penugasan aktif, tidak ada apa pun yang
  // boleh dibaca orang ini — dan halaman kosong tanpa penjelasan lebih buruk
  // daripada dikembalikan ke tempat yang memang bisa ia buka.
  if (!seluruhnya && papan.total === 0 && !sp.status && !sp.overdue) redirect("/dashboard");

  return (
    <div className="w-full">
      <PageHeader
        icon={ListChecks}
        title="Work"
        description="Pekerjaan yang lahir dari Signal — siapa menanggung, siapa mengerjakan, dan kapan tenggatnya"
      />
      <PapanWorkUI papan={papan} />
    </div>
  );
}
