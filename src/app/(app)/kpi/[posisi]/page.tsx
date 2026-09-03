import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { bulanSebelum, daftarPeriodeKpi, laporanKpi, periodeSekarang } from "@/lib/data/kpi";
import { DEPARTEMEN, departemenDari, posisiDari, posisiDepartemen, type KodePosisi } from "@/lib/kpi/struktur";
import { MENU_POSISI, bolehAturKpi } from "@/lib/kpi/akses";
import { NAV_ICONS } from "@/components/layout/icons";
import { PageHeader } from "@/components/ui/page-header";
import { PapanKpi } from "@/components/kpi/papan-kpi";

export const metadata: Metadata = { title: "KPI" };

/**
 * Satu halaman untuk sepuluh posisi.
 *
 * Yang membedakan posisi hanya daftar indikatornya, dan itu sudah ditentukan
 * di lapisan data. Membuat satu halaman per posisi berarti sepuluh berkas yang
 * harus diubah serempak setiap kali susunan tabelnya bergeser.
 */
export default async function KpiPosisiPage({
  params,
  searchParams,
}: {
  params: Promise<{ posisi: string }>;
  searchParams: Promise<{ periode?: string }>;
}) {
  const { posisi: kode } = await params;
  const { periode } = await searchParams;

  const posisi = posisiDari(kode);
  const menu = MENU_POSISI[kode as KodePosisi];
  if (!posisi || !menu) notFound();

  const user = await requireSessionUser();
  if (!canReachMenu(user, menu as MenuKey)) redirect("/dashboard");

  const sekarang = periodeSekarang();
  // Periode dari alamat hanya diterima bila bentuknya benar. Tanpa penjagaan
  // ini, "?periode=besok" akan menghasilkan kueri tanggal yang tidak masuk akal
  // dan halaman kosong yang tidak bisa dijelaskan.
  const dipakai = periode && /^\d{4}-\d{2}$/.test(periode) ? periode : sekarang;

  // Capaian bulan lalu dibaca sekalian: grafiknya membandingkan dua bulan,
  // dan menghitungnya di peramban berarti mengirim seluruh data mentah ke sana.
  const [laporan, sebelum] = await Promise.all([
    laporanKpi(posisi.kode, dipakai),
    laporanKpi(posisi.kode, bulanSebelum(dipakai)),
  ]);
  const lalu = Object.fromEntries(sebelum.baris.map((b) => [b.key, b.persentase]));
  const dep = departemenDari(posisi.departemen);

  return (
    <div className="w-full">
      <PageHeader
        icon={NAV_ICONS.Target}
        title={posisi.nama}
        description={`Key Performance Indicator · ${dep?.nama ?? "—"}`}
      />
      <PapanKpi
        laporan={laporan}
        lalu={lalu}
        namaPosisi={posisi.nama}
        departemen={posisi.departemen}
        pic={posisi.pic}
        periodeOpsi={daftarPeriodeKpi(sekarang)}
        departemenOpsi={DEPARTEMEN.filter((d) => d.posisi.length > 0).map((d) => ({ value: d.kode, label: d.nama }))}
        posisiOpsi={posisiDepartemen(posisi.departemen).map((p) => ({ value: p.kode, label: p.nama }))}
        bolehAtur={bolehAturKpi(user)}
      />
    </div>
  );
}
