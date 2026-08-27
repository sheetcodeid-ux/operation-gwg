import { ArrowLeft, ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { listTabel } from "@/lib/data/hcmos-lanjutan";
import { PageHeader } from "@/components/ui/page-header";
import { PanduanModul } from "@/components/hcmos/panduan-modul";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { AssessmentBoard } from "@/components/hcmos/assessment-board";
import { bacaRekamanPelatihan } from "@/lib/hcmos/pelatihan-baca";
import { DURASI_POST_TEST_MENIT, NILAI_LULUS } from "@/lib/hcmos/lanjutan";

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

  return (
    <div className="w-full">
      <Link
        href="/hc-mos"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> HC-MOS
      </Link>

      <PageHeader
        icon={ClipboardCheck}
        title="Pre Test & Post Test"
        description={`Penilaian seluruh muatan materi Fast Start / Fast Track — setiap materi punya Pre Test (sebelum materi), Role Play (praktik), dan Post Test (${DURASI_POST_TEST_MENIT} menit, sesudah materi). Nilainya diakumulasikan jadi satu nilai akhir; kelulusan minimal ${NILAI_LULUS}.`}
        actions={<PanduanModul panduan="assessment" />}
      />
      <KonteksModul panduan="assessment" />

      <AssessmentBoard rekaman={rekaman} />
    </div>
  );
}
