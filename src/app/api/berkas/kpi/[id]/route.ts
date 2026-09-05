import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { entriBerkas } from "@/lib/data/kpi";
import { MENU_POSISI, picTerkunci } from "@/lib/kpi/akses";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import type { KodePosisi } from "@/lib/kpi/struktur";
import { halamanGalatBerkas, sajikanBerkas } from "@/lib/storage/berkas-rute";

/**
 * Membuka bukti Hygiene Audit / CCTV pada satu catatan KPI.
 *
 * Alasan tautannya bukan presigned URL ada di `src/lib/storage/berkas-rute.ts`.
 * Yang khusus di sini: buktinya adalah dasar penilaian seseorang, jadi
 * cakupannya dibuat sama persis dengan cakupan KPI-nya sendiri — yang tidak
 * boleh membuka rapor satu posisi juga tidak boleh mengambil lampirannya, dan
 * Coordinator Area yang terkunci ke areanya sendiri tidak bisa mengambil bukti
 * milik rekannya.
 *
 * `?unduh=1` membuat berkasnya tersimpan alih-alih terbuka di tab.
 *
 * `?isi=1` mengalirkan ISINYA lewat rute ini, bukan mengalihkan ke penyimpanan.
 * Dipakai tombol unduh massal: pengalihan membawa peramban ke domain lain, dan
 * di sana `fetch` tidak boleh membaca jawabannya tanpa pengaturan CORS — yang
 * artinya bukti tidak bisa dikumpulkan jadi satu arsip. Dialirkan dari sini,
 * seluruhnya tetap satu domain.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jalur = req.nextUrl.searchParams.get("p") ?? "";

  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));

  const entri = await entriBerkas(id);
  if (!entri) return halamanGalatBerkas("Catatan KPI-nya tidak ditemukan.", 404);

  const menu = MENU_POSISI[entri.posisi as KodePosisi];
  if (!menu || !canReachMenu(user, menu as MenuKey)) {
    return halamanGalatBerkas("KPI posisi ini di luar cakupan Anda.", 403);
  }
  const kunci = picTerkunci(user);
  if (kunci && entri.pic !== kunci) return halamanGalatBerkas("Bukti ini milik area lain.", 403);

  // Jalurnya harus benar-benar tercatat pada catatan ini. Tanpa pemeriksaan
  // ini, siapa pun yang boleh membuka satu catatan bisa menukar `p` dengan
  // kunci apa pun di dalam penyimpanan.
  const berkas = entri.lampiran.find((l) => l.path === jalur);
  if (!berkas) return halamanGalatBerkas("Berkas tidak ada pada catatan ini.", 404);

  const unduh = req.nextUrl.searchParams.get("unduh") === "1";
  const alih = await sajikanBerkas(berkas.path, unduh ? berkas.name : undefined);
  if (!alih) return halamanGalatBerkas("Berkasnya tidak bisa dibuka saat ini. Coba lagi sebentar lagi.", 502);
  if (req.nextUrl.searchParams.get("isi") !== "1") return alih;

  const asal = alih.headers.get("location");
  if (!asal) return halamanGalatBerkas("Berkasnya tidak bisa dibuka saat ini. Coba lagi sebentar lagi.", 502);
  const hulu = await fetch(asal).catch(() => null);
  if (!hulu?.ok || !hulu.body) return halamanGalatBerkas("Berkasnya tidak bisa diambil saat ini.", 502);
  return new NextResponse(hulu.body, {
    headers: {
      "content-type": hulu.headers.get("content-type") ?? "application/octet-stream",
      ...(hulu.headers.get("content-length") ? { "content-length": hulu.headers.get("content-length")! } : {}),
      "cache-control": "private, no-store",
    },
  });
}
