import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { getOutlets } from "@/lib/data/store";
import { canAccessOutlet } from "@/lib/rbac";
import { listKontrak, rekapOutlet } from "@/lib/data/hcmos";
import { bolehUbahHc } from "@/lib/hcmos/akses";
import { periodeKey } from "@/lib/hcmos/kontrak";
import { KonteksModul } from "@/components/hcmos/konteks-modul";
import { KontrakBoard } from "@/components/hcmos/kontrak-board";

export const metadata: Metadata = { title: "Kontrak Tracker — HC-MOS" };

export default async function KontrakPage() {
  const user = await requireSessionUser();
  if (!canReachMenu(user, "hc_kontrak")) redirect("/dashboard");

  const periode = periodeKey();
  const [outlets, kontrak] = await Promise.all([rekapOutlet(user, periode), listKontrak(user)]);

  // Outlet yang boleh DITULIS — bukan sekadar yang boleh dilihat. Head HC
  // melihat seluruh outlet, tapi yang mengisi data karyawan tetap supervisor
  // outletnya. Daftar ini ditentukan server; tombolnya di peramban hanya
  // mengikuti, dan server tetap memeriksa ulang setiap penyimpanan.
  const semua = getOutlets();
  const outletSaya = outlets.filter((o) => canAccessOutlet(user, o.id, semua)).map((o) => o.id);

  // Tanpa kepala halaman: bingkai modulnya sudah membawa judul, angka ringkas,
  // pencarian, dan panduannya sendiri — sama seperti Struktur Organisasi dan
  // Matriks RACI. Dua judul untuk satu layar hanya memakan tinggi.
  return (
    <div className="flex w-full flex-col">
      <KonteksModul panduan="kontrak" />
      {/* Karyawan Manajemen tidak punya outlet, jadi wewenangnya tidak bisa
          diturunkan dari daftar outlet mana pun — ditentukan terpisah, di
          server, lalu diperiksa ulang setiap penyimpanan. */}
      <KontrakBoard
        outlets={outlets}
        kontrak={kontrak}
        periode={periode}
        outletSaya={outletSaya}
        bolehManajemen={bolehUbahHc(user)}
      />
    </div>
  );
}
