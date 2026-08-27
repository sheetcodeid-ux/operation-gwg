import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { visibleOutlets } from "@/lib/data/store";
import { listHcSubmissions } from "@/lib/data/hc";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { NewSubmissionButton, SubmissionList } from "@/components/hc/hc-submit";

export const metadata: Metadata = { title: "Pengajuan Dokumen" };

export default async function HcPengajuanPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_submit")) redirect("/dashboard");

  const outlets = visibleOutlets(user).map((o) => ({ id: o.id, name: o.name }));
  // Supervisors see only their own submissions; Admin (oversight) sees all.
  // The list doesn't render the KTP, so skip signing it (faster load).
  const rows = await listHcSubmissions({ supervisorId: user.role === "super_admin" ? undefined : user.id, withKtp: false });

  // Tanpa kepala halaman: bingkai modulnya membawa judul, angka ringkas,
  // pencarian, dan panduannya sendiri.
  return (
    <div className="flex w-full flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <KonteksModul panduan="hc_pengajuan" />
        {/* Tombol utamanya di luar bingkai: ia membuka formulir baru, bukan
            mengubah apa yang sedang tampil di dalam bingkai. */}
        <div className="mb-4">
          <NewSubmissionButton outlets={outlets} />
        </div>
      </div>
      <SubmissionList rows={rows} />
    </div>
  );
}
