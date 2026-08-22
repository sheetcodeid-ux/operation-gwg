import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getHcRequest } from "@/lib/data/hc-requests";
import { canSeeRequest } from "@/lib/data/request-scope";
import { kelolaAntrianDesign } from "@/lib/hc-request";
import { halamanGalatBerkas, sajikanBerkas } from "@/lib/storage/berkas-rute";

/**
 * Membuka satu lampiran pengajuan (rekrutmen, pelatihan, design).
 *
 * Alasan rute ini ada — dan mengapa tautannya bukan presigned URL — ada di
 * `src/lib/storage/berkas-rute.ts`.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jalur = req.nextUrl.searchParams.get("p") ?? "";
  const unduh = req.nextUrl.searchParams.get("unduh");

  const user = await getSessionUser().catch(() => null);
  if (!user) {
    // Dialihkan ke login, bukan 401 mentah: tautan ini dibuka di tab baru, dan
    // yang mengkliknya hampir selalu hanya perlu masuk lagi.
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  const pengajuan = await getHcRequest(id);
  if (!pengajuan) return halamanGalatBerkas("Pengajuan tidak ditemukan.", 404);
  if (!canSeeRequest(user, pengajuan)) return halamanGalatBerkas("Anda tidak berhak membuka berkas ini.", 403);

  // Berkasnya harus benar-benar milik pengajuan ini. Tanpa pemeriksaan ini,
  // siapa pun yang boleh membuka satu pengajuan bisa menukar `p` dengan kunci
  // apa pun di dalam bucket dan mengambilnya lewat rute ini.
  //
  // Hasil design yang masih menunggu ACC belum ada di `attachments` — memang
  // sengaja, itulah yang menahannya dari pemohon. Yang memeriksanya tetap harus
  // bisa membukanya, jadi ruang tunggu itu ikut dicari DI SINI dan hanya untuk
  // dua pihak yang berkepentingan: yang mengerjakannya dan yang meng-ACC-nya.
  const bolehLihatHasil =
    pengajuan.kind === "design" && (pengajuan.assigneeId === user.id || kelolaAntrianDesign(user));
  const lampiran =
    pengajuan.attachments.find((a) => a.path === jalur) ??
    (bolehLihatHasil ? pengajuan.hasil?.attachments.find((a) => a.path === jalur) : undefined);
  if (!lampiran) return halamanGalatBerkas("Berkas tidak ada pada pengajuan ini.", 404);

  return (
    (await sajikanBerkas(jalur, unduh ? lampiran.name : undefined)) ??
    halamanGalatBerkas("Berkasnya tidak bisa dibuka saat ini. Coba lagi sebentar lagi.", 502)
  );
}
