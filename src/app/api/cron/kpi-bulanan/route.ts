import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { catatHasilSinkron } from "@/lib/data/sinkron-sehat";
import { generateTerjadwal } from "@/lib/data/kpi-generate";

/**
 * Penulis KPI bulanan yang berjalan sendiri.
 *
 * Dipicu pg_cron Supabase lewat `net.http_get`, pola yang sama dengan
 * `/api/cron/fraud-sync`. Bedanya satu dan penting: rute ini TIDAK MENYENTUH
 * ESB sama sekali. Seluruh masukannya sudah ada di basis data, jadi ia tidak
 * mengambil sewa ESB, tidak ikut antre di belakang penarikan, dan tidak ikut
 * gagal ketika ESB sedang membatasi permintaan.
 *
 * ┌─ GAGAL HARUS TERLIHAT GAGAL ─────────────────────────────────────────────┐
 * │                                                                          │
 * │ `cron.job_run_details` melaporkan "succeeded" begitu permintaan HTTP-nya │
 * │ terkirim — bukan ketika pekerjaannya selesai. Itu sudah pernah menutupi  │
 * │ penarikan yang gagal sembilan kali beruntun. Jadi di sini: generasi yang │
 * │ gagal membalas 500 DAN menulis `error` ke `sinkron_sehat`, supaya kedua  │
 * │ tempat yang mungkin diperiksa orang mengatakan hal yang sama.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Hasilnya idempoten: memanggil rute ini dua kali dalam satu hari WIB tidak
 * melahirkan versi baru, karena angkanya identik dan `gwg_tulis_kpi_bulanan`
 * membandingkan isi sebelum menulis.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await cronAuthorized(req, "kpi_bulanan_token", "kpi-bulanan"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const mulai = Date.now();
  try {
    const hasil = await generateTerjadwal();
    // Bentuk yang dimengerti `bacaHasil()`: tanpa `error` dan `sisa` nol
    // berarti tuntas.
    const ringkas = {
      sisa: 0,
      periode: hasil.map((h) => h.periode),
      berubah: hasil.filter((h) => h.berubah).length,
      versi: Object.fromEntries(hasil.map((h) => [h.periode, h.versi])),
      baris: hasil.reduce((n, h) => n + h.nilaiDisisipkan, 0),
      target: hasil.reduce((n, h) => n + h.targetDisisipkan, 0),
      msTotal: Date.now() - mulai,
    };
    await catatHasilSinkron({ "kpi-bulanan": ringkas });
    return NextResponse.json({ ok: true, tookMs: Date.now() - mulai, hasil });
  } catch (e) {
    const pesan = e instanceof Error ? e.message : "gagal";
    console.error("[cron:kpi-bulanan] gagal:", pesan);
    await catatHasilSinkron({ "kpi-bulanan": { error: pesan } });
    return NextResponse.json({ ok: false, tookMs: Date.now() - mulai, error: pesan }, { status: 500 });
  }
}
