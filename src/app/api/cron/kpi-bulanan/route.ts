import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { catatHasilSinkron } from "@/lib/data/sinkron-sehat";
import { generateTerjadwal } from "@/lib/data/kpi-generate";
import { finalisasiPeriodeSelesai } from "@/lib/data/kpi-finalisasi";
import { deteksiPeriode } from "@/lib/data/signals";

/**
 * Penulis KPI bulanan yang berjalan sendiri, plus penutup periode.
 *
 * Dipicu pg_cron Supabase lewat `net.http_get`, pola yang sama dengan
 * `/api/cron/fraud-sync`. Bedanya satu dan penting: rute ini TIDAK MENYENTUH
 * ESB sama sekali. Seluruh masukannya sudah ada di basis data, jadi ia tidak
 * mengambil sewa ESB, tidak ikut antre di belakang penarikan, dan tidak ikut
 * gagal ketika ESB sedang membatasi permintaan.
 *
 * ┌─ TIGA PEKERJAAN, URUTANNYA MENGIKAT ─────────────────────────────────────┐
 * │                                                                          │
 * │   1. generasi     — menulis ulang bulan BERJALAN                         │
 * │   2. finalisasi   — menutup bulan yang kalendernya SUDAH HABIS           │
 * │   3. deteksi      — mencatat pelanggaran aturan                          │
 * │                                                                          │
 * │ Dua yang pertama menyentuh himpunan periode yang terpisah, jadi urutannya│
 * │ tidak bisa saling merusak. Generasi didahulukan karena ia jalur utamanya:│
 * │ kalau ia gagal, rute berhenti di situ dan tidak ada periode yang ikut    │
 * │ ditutup atas dasar data yang tidak jadi ditulis.                         │
 * │                                                                          │
 * │ Deteksi WAJIB paling akhir, dan itu bukan selera. Ia menilai angka yang  │
 * │ baru saja ditulis, dan ia menyalin `status` KPI ke dalam Signal — kalau  │
 * │ ia jalan sebelum finalisasi, Signal Agustus akan mencatat "sementara"    │
 * │ padahal bulannya sudah ditutup satu langkah kemudian.                    │
 * │                                                                          │
 * │ Ketiganya transaksi sendiri-sendiri. Generasi yang sudah berhasil tidak  │
 * │ dibatalkan hanya karena deteksi gagal — hasilnya sah dan idempoten —     │
 * │ tapi kegagalannya TETAP membuat rute membalas 500 dan `sinkron_sehat`    │
 * │ mencatat galat. Yang tidak boleh terjadi adalah melapor tuntas padahal   │
 * │ separuhnya tidak jalan.                                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ GAGAL HARUS TERLIHAT GAGAL ─────────────────────────────────────────────┐
 * │                                                                          │
 * │ `cron.job_run_details` melaporkan "succeeded" begitu permintaan HTTP-nya │
 * │ terkirim — bukan ketika pekerjaannya selesai. Itu sudah pernah menutupi  │
 * │ penarikan yang gagal sembilan kali beruntun.                             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Hasilnya idempoten: memanggil rute ini dua kali dalam satu hari WIB tidak
 * melahirkan versi baru, tidak mengubah satu status pun untuk kedua kalinya,
 * dan tidak melahirkan satu Signal kembar pun.
 *
 * TIDAK ADA NOTIFIKASI DI SINI, termasuk untuk severity `critical` (AD-14).
 * Phase 4 berhenti di Signal yang tersimpan; layar tujuannya belum ada, jadi
 * notifikasinya belum punya alamat.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await cronAuthorized(req, "kpi_bulanan_token", "kpi-bulanan"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const mulai = Date.now();
  try {
    const generasi = await generateTerjadwal();
    const finalisasi = await finalisasiPeriodeSelesai();

    // Bulan berjalan PLUS bulan yang baru saja ditutup pada jalan ini. Periode
    // lama tidak ikut dinilai ulang: aturannya sudah tidak bergerak dan
    // Signal-nya sudah tercatat, jadi memeriksanya lagi cuma pekerjaan tanpa
    // hasil. Periode yang aturannya BARU lahir ditangani saat aturannya dibuat.
    const deteksi = await deteksiPeriode([...generasi.map((h) => h.periode), ...finalisasi.periodeDifinalisasi]);

    // Bentuk yang dimengerti `bacaHasil()`: tanpa `error` dan `sisa` nol
    // berarti tuntas. Generasi dan finalisasi dipisah supaya yang membaca
    // `sinkron_sehat` tahu bagian mana yang bergerak.
    const ringkas = {
      sisa: 0,
      generasi: {
        periode: generasi.map((h) => h.periode),
        berubah: generasi.filter((h) => h.berubah).length,
        versi: Object.fromEntries(generasi.map((h) => [h.periode, h.versi])),
        baris: generasi.reduce((n, h) => n + h.nilaiDisisipkan, 0),
        target: generasi.reduce((n, h) => n + h.targetDisisipkan, 0),
      },
      finalisasi: {
        bulan_berjalan: finalisasi.bulanBerjalan,
        periode_diperiksa: finalisasi.periodeDiperiksa,
        periode_difinalisasi: finalisasi.periodeDifinalisasi,
        baris_diubah: finalisasi.barisDiubah,
      },
      deteksi: {
        periode: deteksi.map((d) => d.periode),
        diperiksa: deteksi.reduce((n, d) => n + d.diperiksa, 0),
        layak: deteksi.reduce((n, d) => n + d.layak, 0),
        disisipkan: deteksi.reduce((n, d) => n + d.disisipkan, 0),
        diperbarui: deteksi.reduce((n, d) => n + d.diperbarui, 0),
        diamati_saja: deteksi.reduce((n, d) => n + d.diamatiSaja, 0),
      },
      msTotal: Date.now() - mulai,
    };
    await catatHasilSinkron({ "kpi-bulanan": ringkas });
    return NextResponse.json({ ok: true, tookMs: Date.now() - mulai, generasi, finalisasi, deteksi });
  } catch (e) {
    const pesan = e instanceof Error ? e.message : "gagal";
    console.error("[cron:kpi-bulanan] gagal:", pesan);
    await catatHasilSinkron({ "kpi-bulanan": { error: pesan } });
    return NextResponse.json({ ok: false, tookMs: Date.now() - mulai, error: pesan }, { status: 500 });
  }
}
