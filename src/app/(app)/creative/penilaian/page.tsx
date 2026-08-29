import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getArea, getUsers } from "@/lib/data/store";
import { areaTerlihat, dashboardPenilaian, penerimaLaporan } from "@/lib/data/creative-penilaian";
import { bolehKirimLaporanPenilaian, bolehLihatSemuaArea } from "@/lib/creative/akses";
import { PenilaianBoard } from "@/components/creative/penilaian-board";

export const metadata: Metadata = { title: "Penilaian Request Design" };

/**
 * Dashboard penilaian terhadap YANG MEMINTA design.
 *
 * Aksesnya mengikuti menunya sendiri, bukan menu Antrian Design: yang perlu
 * membacanya bukan hanya tim Creative, melainkan juga Coordinator Area yang
 * dievaluasi lewat angka ini. Sebaliknya seorang designer tidak perlu — dan
 * sebaiknya tidak — melihat rapor wilayah setiap hari.
 *
 * Coordinator Area hanya menerima wilayahnya sendiri, dan penyaringannya
 * dilakukan DI SERVER. Menyaringnya di layar berarti rapor wilayah lain tetap
 * ikut terkirim ke peramban dan terbaca siapa pun yang membuka alat pengembang.
 */
export default async function PenilaianRequestPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "creative_penilaian")) redirect("/dashboard");

  const semuaArea = bolehLihatSemuaArea(user);
  const lingkup = areaTerlihat(user, semuaArea);
  const data = await dashboardPenilaian(lingkup);

  return (
    <div className="w-full">
      <PenilaianBoard
        data={data}
        bolehKirim={bolehKirimLaporanPenilaian(user)}
        penerima={bolehKirimLaporanPenilaian(user) ? penerimaLaporan(getUsers()) : []}
        lingkupArea={lingkup === null ? null : lingkup.map((id) => getArea(id)?.name ?? "—")}
      />
    </div>
  );
}
