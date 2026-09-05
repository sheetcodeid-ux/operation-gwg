import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { bulanSebelum, laporanKpi, periodeSekarang, picDinamis } from "@/lib/data/kpi";
import { SEMUA_PIC } from "@/lib/kpi/semua-pic";
import { listEsbMenus } from "@/lib/data/esb-menu";
import { getOutlets } from "@/lib/data/store";
import { TENGGAT, indikatorPosisi } from "@/lib/kpi/indikator";
import { departemenDari, posisiDari, posisiDepartemen, type KodePosisi } from "@/lib/kpi/struktur";
import { MENU_POSISI, bolehAngkaPenjualan, bolehAturKpi, picTerkunci } from "@/lib/kpi/akses";
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
  searchParams: Promise<{ periode?: string; pic?: string }>;
}) {
  const { posisi: kode } = await params;
  const { periode, pic } = await searchParams;

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

  // Posisi yang dinilai per orang selalu membuka SESEORANG. Tanpa bawaan,
  // halamannya terbuka kosong dan terbaca seperti belum ada datanya sama
  // sekali — padahal cuma belum memilih siapa.
  // Posisi yang PIC-nya datang dari basis data memakai ID orangnya sebagai
  // nilai, dan namanya hanya untuk dibaca. Nama berubah — menikah, salah ketik
  // dibetulkan — dan seluruh riwayat angkanya akan terputus tanpa ada yang
  // menyadarinya.
  // Coordinator Area hanya boleh membaca areanya sendiri. Daftarnya dipangkas
  // di sini DAN penulisannya dijaga di server — memangkas daftarnya saja cuma
  // menyembunyikan tombol, bukan menutup jalannya.
  const kunci = picTerkunci(user);
  const picOpsi = kunci
    ? picDinamis(posisi.kode).filter((o) => o.value === kunci)
    : posisi.picDinamis
      ? picDinamis(posisi.kode)
      : posisi.pic.map((n) => ({ value: n, label: n }));
  // "Semua" menggabungkan seluruh area — dihitung sekali per area, bukan per
  // orang, supaya area yang dipegang tiga orang tidak terhitung tiga kali.
  if (!kunci && posisi.picDinamis && picOpsi.length > 1) {
    picOpsi.unshift({ value: SEMUA_PIC, label: "Semua Coordinator Area" });
  }
  const picAktif = posisi.perPic
    ? (pic && picOpsi.some((o) => o.value === pic) ? pic : (picOpsi[0]?.value ?? ""))
    : "";

  const daftar = indikatorPosisi(posisi.kode);
  // Katalog menu ESB hanya perlu dibaca oleh posisi yang menilai Keberhasilan
  // Pasar. Membacanya untuk sepuluh posisi berarti sembilan kueri katalog yang
  // hasilnya tidak pernah dipakai.
  const pakaiPasar = daftar.some((i) => i.key === "keberhasilan_pasar");

  // Capaian bulan lalu dibaca sekalian: grafiknya membandingkan dua bulan,
  // dan menghitungnya di peramban berarti mengirim seluruh data mentah ke sana.
  const [laporan, sebelum, menuEsb] = await Promise.all([
    laporanKpi(posisi.kode, dipakai, picAktif),
    laporanKpi(posisi.kode, bulanSebelum(dipakai), picAktif),
    pakaiPasar ? listEsbMenus() : Promise.resolve([]),
  ]);
  // Persen DAN nominalnya dikirim: grafiknya bisa ditukar antara dua satuan,
  // dan tanpa nominal bulan lalu perbandingannya jadi timpang — dua dari tiga
  // garis berangka, satu tidak.
  const lalu = Object.fromEntries(sebelum.baris.map((b) => [b.key, { persen: b.persentase, actual: b.actual }]));
  const dep = departemenDari(posisi.departemen);

  return (
    <div className="w-full">
      {/* Hanya judul tak terlihat — lihat `page-header.tsx`. Remah roti di
          bilah atas sudah menyebut nama halaman yang sama. */}
      <PageHeader title={posisi.nama} />
      <PapanKpi
        laporan={laporan}
        lalu={lalu}
        namaPosisi={posisi.nama}
        namaDepartemen={dep?.nama ?? "—"}
        pic={picOpsi.map((o) => o.label)}
        picOpsi={picOpsi}
        perPic={!!posisi.perPic}
        indikator={daftar}
        outlets={getOutlets()
          .filter((o) => o.active)
          .map((o) => ({ id: o.id, nama: o.name }))
          .sort((a, b) => a.nama.localeCompare(b.nama, "id"))}
        tenggatHari={TENGGAT[posisi.kode] ?? [15]}
        posisiOpsi={posisiDepartemen(posisi.departemen).map((p) => ({ value: p.kode, label: p.nama }))}
        bolehAtur={bolehAturKpi(user)}
        bolehAngkaPenjualan={bolehAngkaPenjualan(user)}
        menuEsb={menuEsb.map((m) => ({
          menu: m.menu,
          kategori: m.categoryDetail || m.category,
          estimasi: m.qty30d * m.unitPrice,
        }))}
      />
    </div>
  );
}
