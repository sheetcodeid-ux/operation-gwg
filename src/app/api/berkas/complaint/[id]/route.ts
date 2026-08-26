import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getComplaint, getOutlets } from "@/lib/data/store";
import { canAccessOutlet } from "@/lib/rbac";
import { halamanGalatBerkas, sajikanBerkas } from "@/lib/storage/berkas-rute";

/**
 * Membuka foto verifikasi Coordinator Area pada satu komplain.
 *
 * Alasan rute ini ada — dan mengapa tautannya bukan presigned URL — ada di
 * `src/lib/storage/berkas-rute.ts`. Yang khusus di sini: fotonya dulu ditaruh
 * di bucket `avatars` yang publik, jadi bukti verifikasi sebuah cabang bisa
 * diambil siapa pun yang tahu jalurnya, tanpa masuk sama sekali.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jalur = req.nextUrl.searchParams.get("p") ?? "";

  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));

  const komplain = getComplaint(id);
  if (!komplain) return halamanGalatBerkas("Komplain tidak ditemukan.", 404);

  // Cakupannya sama dengan cakupan komplainnya sendiri: yang tidak boleh
  // membuka cabangnya juga tidak boleh melihat bukti perbaikannya.
  if (!canAccessOutlet(user, komplain.outletId, getOutlets())) {
    return halamanGalatBerkas("Cabang ini di luar cakupan Anda.", 403);
  }

  // Berkasnya harus benar-benar tercatat pada komplain ini. Tanpa pemeriksaan
  // ini, siapa pun yang boleh membuka satu komplain bisa menukar `p` dengan
  // kunci apa pun di dalam bucket.
  if (!jalur || komplain.approval?.photoUrl !== jalur) {
    return halamanGalatBerkas("Berkas tidak ada pada komplain ini.", 404);
  }

  return (
    (await sajikanBerkas(jalur)) ??
    halamanGalatBerkas("Berkasnya tidak bisa dibuka saat ini. Coba lagi sebentar lagi.", 502)
  );
}
