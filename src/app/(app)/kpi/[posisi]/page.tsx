import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { daftarPeriodeKpi, laporanKpi, periodeSekarang } from "@/lib/data/kpi";
import { departemenDari, posisiDari, type KodePosisi } from "@/lib/kpi/struktur";
import { MENU_POSISI, bolehAturKpi } from "@/lib/kpi/akses";
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

  const laporan = await laporanKpi(posisi.kode, dipakai);
  const dep = departemenDari(posisi.departemen);

  return (
    <div className="w-full">
      <PapanKpi
        laporan={laporan}
        namaPosisi={posisi.nama}
        pic={posisi.pic}
        departemen={dep?.nama ?? "—"}
        ikon={dep?.ikon ?? "Target"}
        periodeOpsi={daftarPeriodeKpi(sekarang)}
        bolehAtur={bolehAturKpi(user)}
      />
    </div>
  );
}
