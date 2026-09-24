import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { detailWork } from "@/lib/data/work-daftar";
import { canReachMenu, MENU_WORK } from "@/lib/nav";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page-header";
import { DetailWorkUI } from "@/components/operation/detail-work";

export const metadata: Metadata = { title: "Detail Work" };
export const maxDuration = 60;

/**
 * SATU WORK, DAN SELURUH YANG MELEKAT PADANYA.
 *
 * ┌─ YANG TIDAK BOLEH DIBACA DIKEMBALIKAN, BUKAN DIBERI 404 ─────────────────┐
 * │                                                                          │
 * │ "Tidak ditemukan" dan "tidak boleh dilihat" adalah dua jawaban berbeda,  │
 * │ dan membedakannya di layar memberi tahu penanya bahwa Work bernomor itu  │
 * │ MEMANG ADA. Keduanya karena itu berakhir sama: kembali ke dashboard.     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Work terminal TETAP terbaca penuh. Yang berhenti mutasinya, bukan
 * pembacaannya (AD-20 · G).
 */
export default async function DetailWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireSessionUser();
  const { id } = await params;
  const nomor = Number(id);

  const detail = Number.isInteger(nomor) && nomor > 0 ? await detailWork(nomor) : null;
  if (!detail) redirect("/dashboard");

  const pelaksanaAktif = detail.pelaksana.some((p) => p.userId === user.id && p.aktif);
  if (!canReachMenu(user, MENU_WORK) && !pelaksanaAktif) redirect("/dashboard");

  return (
    <div className="w-full">
      <PageHeader icon={ListChecks} title={detail.judul} description={`Work #${detail.id}`} />
      <DetailWorkUI
        detail={detail}
        aktor={user.id}
        kelola={can(user, "manage_signals")}
        pelaksanaAktif={pelaksanaAktif}
      />
    </div>
  );
}
