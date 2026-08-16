import { NextResponse } from "next/server";
import { bersihkanFotoHygiene } from "@/lib/data/hygiene-bersih";
import { cronAuthorized } from "@/lib/cron-auth";

/**
 * Pembersih foto Hygiene — berjalan sendiri, tanpa ditunggui.
 *
 * Foto audit dibutuhkan selama bulan berjalan, untuk menindaklanjuti temuan.
 * Setelah bulannya tutup, yang dipakai tinggal NILAINYA — dan nilai itu ada di
 * kolom lain, tidak ikut terhapus. Tanpa pembersihan, penyimpanan bertambah
 * beberapa gigabyte per bulan untuk gambar yang tidak dibuka siapa pun lagi.
 *
 * Dijadwalkan HARIAN, bukan bulanan, dan itu disengaja: satu jalan dibatasi
 * anggaran waktu supaya tidak dimatikan Vercel di detik ke-60, jadi tumpukan
 * besar diselesaikan bertahap dalam beberapa hari. Pada hari-hari yang sudah
 * bersih, rutenya selesai seketika tanpa menghapus apa pun.
 *
 * Parameter (semuanya opsional):
 *   ?kering=1        hitung saja, jangan hapus — untuk memastikan cakupannya
 *                    dulu sebelum benar-benar dijalankan.
 *   ?simpan=2        pertahankan 2 bulan terakhir (bawaan: 1, bulan berjalan).
 *   ?yatim=0         lewati penyapuan berkas yang tidak dirujuk siapa pun.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await cronAuthorized(req, "bersih_foto_token", "bersih-foto"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const q = new URL(req.url).searchParams;
  const mulai = Date.now();
  try {
    const hasil = await bersihkanFotoHygiene({
      simpanBulan: Math.max(1, Number(q.get("simpan") ?? "1") || 1),
      kering: q.get("kering") === "1",
      sapuYatim: q.get("yatim") !== "0",
      anggaranMs: 45_000,
    });
    return NextResponse.json({ ok: true, tookMs: Date.now() - mulai, ...hasil });
  } catch (e) {
    // Kegagalan pembersihan tidak boleh diam-diam: kalau rutenya balas 200
    // seolah sukses, penyimpanan terus menumpuk tanpa ada yang tahu.
    console.error("[cron:bersih-foto] gagal:", e);
    return NextResponse.json(
      { ok: false, tookMs: Date.now() - mulai, error: e instanceof Error ? e.message : "gagal" },
      { status: 500 },
    );
  }
}
