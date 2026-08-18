import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSystemRequestRow } from "@/lib/data/system";
import { isHelpdeskOwner, isSystemSupport, type SysDesk } from "@/lib/system-shared";
import { halamanGalatBerkas, sajikanBerkas } from "@/lib/storage/berkas-rute";
import type { UserProfile } from "@/lib/types";

/**
 * Membuka satu berkas tiket — lampiran dari pemohon maupun hasil pengerjaan.
 *
 * Alasan rute ini ada — dan mengapa tautannya bukan presigned URL — ada di
 * `src/lib/storage/berkas-rute.ts`. Bentuknya sengaja sama persis dengan rute
 * lampiran pengajuan; yang berbeda hanya siapa yang berhak.
 */

/** Pemohonnya sendiri, atau tim yang memang menangani meja tiket itu. */
function bolehBukaTiket(user: UserProfile, requesterId: string | null, desk: SysDesk): boolean {
  if (requesterId && requesterId === user.id) return true;
  return desk === "helpdesk" ? isHelpdeskOwner(user) : isSystemSupport(user);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jalur = req.nextUrl.searchParams.get("p") ?? "";
  const unduh = req.nextUrl.searchParams.get("unduh");

  const user = await getSessionUser().catch(() => null);
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));

  const tiket = await getSystemRequestRow(id);
  if (!tiket) return halamanGalatBerkas("Tiket tidak ditemukan.", 404);

  const desk: SysDesk = tiket.desk ?? "system";
  if (!bolehBukaTiket(user, tiket.requester_id, desk)) {
    return halamanGalatBerkas("Anda tidak berhak membuka berkas ini.", 403);
  }

  // Berkasnya harus benar-benar tercatat pada tiket ini — lampiran pemohon atau
  // salah satu hasil pengerjaan. Tanpa pemeriksaan ini, siapa pun yang boleh
  // membuka satu tiket bisa menukar `p` dengan kunci apa pun di dalam bucket.
  const berkasSah = tiket.attachment_path === jalur || (tiket.result_paths ?? []).includes(jalur);
  if (!jalur || !berkasSah) return halamanGalatBerkas("Berkas tidak ada pada tiket ini.", 404);

  const nama = unduh ? tiket.attachment_name || "lampiran" : undefined;
  return (
    (await sajikanBerkas(jalur, nama)) ??
    halamanGalatBerkas("Berkasnya tidak bisa dibuka saat ini. Coba lagi sebentar lagi.", 502)
  );
}
