import { redirect } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import type { Metadata } from "next";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { statusSinkron } from "@/lib/data/sinkron-sehat";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile } from "@/components/ui/stat";
import { TabelSinkronSehat } from "@/components/admin/sinkron-sehat";

export const metadata: Metadata = { title: "Kesehatan Data" };
export const dynamic = "force-dynamic";

/**
 * Kesehatan penarikan otomatis.
 *
 * Halaman ini lahir dari satu kejadian: katalog menu ESB berhenti terisi
 * selama dua belas hari dan tidak ada satu pun tempat di aplikasi ini yang
 * bisa memberi tahu. Cron-nya melapor "berhasil" tiap hari — pg_cron memang
 * hanya mencatat bahwa permintaannya terkirim, bukan hasilnya — jadi
 * kegagalannya baru ketahuan setelah angkanya terlanjur dipakai orang.
 */
export default async function SinkronPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "sinkron" as MenuKey)) redirect("/dashboard");

  const baris = await statusSinkron();
  const hitung = (s: string) => baris.filter((b) => b.status === s).length;
  const bermasalah = hitung("bermasalah") + hitung("belum pernah");

  return (
    <div className="w-full">
      <PageHeader title="Kesehatan Data" />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={RefreshCw} label="Penarikan Dipantau" value={baris.length} sub="Tercatat sejak jalan pertama" />
        <StatTile icon={CheckCircle2} label="Sehat" value={hitung("sehat")} sub="Tuntas dalam jeda wajarnya" />
        <StatTile icon={Clock} label="Tertunda" value={hitung("tertunda")} sub="Lewat jeda wajar, belum gawat" />
        <StatTile
          icon={AlertTriangle}
          label="Bermasalah"
          value={bermasalah}
          sub={bermasalah > 0 ? "Perlu diperiksa sekarang" : "Tidak ada yang mogok"}
        />
      </div>

      {baris.length === 0 ? (
        <div className="card-gradient rounded-2xl p-6 text-center">
          <p className="text-sm font-medium text-foreground">Belum ada penarikan yang tercatat.</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Barisnya muncul sendiri setelah cron berjalan sekali. Kosong di sini berarti belum ada jalan yang tercatat —
            bukan berarti semuanya sehat.
          </p>
        </div>
      ) : (
        <TabelSinkronSehat baris={baris} />
      )}

      <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
        Yang menentukan sehat atau tidak adalah <b>Terakhir Tuntas</b>, bukan Terakhir Dicoba. Penarikan yang mogok tetap
        dicoba tiap hari — itulah sebabnya ia bisa berhenti bekerja berhari-hari tanpa ada yang curiga.
      </p>
    </div>
  );
}
