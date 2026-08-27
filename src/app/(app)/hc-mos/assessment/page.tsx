import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { AssessmentBoard } from "@/components/hcmos/assessment-board";
import { bacaRekamanPelatihan } from "@/lib/hcmos/pelatihan-baca";

export const metadata: Metadata = { title: "Pre Test & Post Test — HC-MOS" };

/**
 * Pre Test & Post Test — sisi penilaian dari Fast Start / Fast Track.
 *
 * Halaman Fast Start & Fast Track menjawab "siapa ikut batch mana"; halaman ini
 * menjawab "materinya sudah diuji sampai mana dan nilainya bergerak ke mana".
 * Keduanya membaca tabel yang sama, jadi tidak ada versi kedua dari nilai yang
 * sama yang bisa mulai berbeda diam-diam.
 */
export default async function AssessmentPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_pretest")) redirect("/dashboard");

  const rekaman = bacaRekamanPelatihan(await listTabel("hc_training_records"));

  // Tanpa kepala halaman: bingkai modulnya membawa judul, angka ringkas, dan
  // panduannya sendiri.
  return (
    <div className="flex w-full flex-col">
      <Link
        href="/hc-mos"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>

      <KonteksModul panduan="assessment" />

      <AssessmentBoard rekaman={rekaman} />
    </div>
  );
}
