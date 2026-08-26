import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { canAccessOutlet } from "@/lib/rbac";
import { getOutlets } from "@/lib/data/store";
import { berkasKontrak } from "@/lib/data/hcmos";
import { bolehUbahHc } from "@/lib/hcmos/akses";
import { alihkanKeBerkas, halamanGalatBerkas, sajikanBerkas } from "@/lib/storage/berkas-rute";

/**
 * Membuka satu berkas milik baris Kontrak Tracker — kontrak, KTP, atau foto.
 *
 * Alasan rute ini ada — dan mengapa tautannya bukan presigned URL — ada di
 * `src/lib/storage/berkas-rute.ts`.
 *
 * Baris lama menyimpan URL Google Drive yang ditempel manual, bukan berkas
 * yang diunggah ke sini. Keduanya harus tetap bisa dibuka dari tempat yang
 * sama: yang berupa tautan luar dialihkan apa adanya, yang berupa berkas
 * ditandatangani pada detik ini juga.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jenis = req.nextUrl.searchParams.get("j") ?? "";
  const unduh = req.nextUrl.searchParams.get("unduh");

  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  if (!canReachMenu(user, "hc_kontrak")) return halamanGalatBerkas("Anda tidak berhak membuka berkas ini.", 403);

  const baris = await berkasKontrak(id);
  if (!baris) return halamanGalatBerkas("Data karyawan tidak ditemukan.", 404);

  // Cakupan yang sama dengan yang berlaku di layar: cabang hanya untuk yang
  // memegang cabang itu, Manajemen hanya untuk yang berwenang atas data HC.
  // Diperiksa di sini juga, bukan hanya saat daftarnya disusun — id baris bisa
  // ditebak, tautannya tidak.
  const boleh = baris.outletId
    ? canAccessOutlet(user, baris.outletId, getOutlets())
    : bolehUbahHc(user);
  if (!boleh) return halamanGalatBerkas("Berkas ini di luar cakupan Anda.", 403);

  const nilai = jenis === "ktp" ? baris.linkKtp : jenis === "foto" ? baris.linkFoto : jenis === "kontrak" ? baris.linkKontrak : null;
  if (!nilai) return halamanGalatBerkas("Berkas itu belum ada pada data ini.", 404);

  // Tautan luar (baris lama yang ditempel manual) dibuka apa adanya.
  if (/^https?:\/\//i.test(nilai)) return alihkanKeBerkas(nilai);

  const nama = `${baris.nama.replace(/[^\w.-]+/g, "_")}-${jenis}`;
  return (
    (await sajikanBerkas(nilai, unduh ? nama : undefined)) ??
    halamanGalatBerkas("Berkasnya tidak bisa dibuka saat ini. Coba lagi sebentar lagi.", 502)
  );
}
