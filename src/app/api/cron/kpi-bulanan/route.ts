import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { catatHasilSinkron } from "@/lib/data/sinkron-sehat";
import { generateTerjadwal } from "@/lib/data/kpi-generate";
import { finalisasiPeriodeSelesai } from "@/lib/data/kpi-finalisasi";
import { deteksiSignal, deteksiTerjadwal, praDeteksi } from "@/lib/data/signals";
import { kabarkanSignalCritical } from "@/lib/data/signal-notifikasi";
import { bolehDiremediasi, REMEDIASI_DIIZINKAN } from "@/lib/ops/deteksi";

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
 * │   3. deteksi      — mencatat pelanggaran aturan, tunggakan lebih dulu    │
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
 * ┌─ PINTU REMEDIASI ────────────────────────────────────────────────────────┐
 * │                                                                          │
 * │   ?mode=deteksi&periode=YYYY-MM[&pratinjau=1]                            │
 * │                                                                          │
 * │ Hanya deteksi: TIDAK menggenerate, TIDAK memfinalisasi, TIDAK menggeser  │
 * │ watermark. Periodenya dibatasi DAFTAR PUTIH di `src/lib/ops/deteksi.ts`, │
 * │ bukan sekadar pemeriksaan bentuk — parameter yang menerima bulan apa pun │
 * │ berarti pemegang token bisa menyuruh sistem menilai ulang bulan mana     │
 * │ saja, dan itu pintu yang tidak pernah diminta siapa pun.                 │
 * │                                                                          │
 * │ Token dan gerbangnya sama persis dengan jalur terjadwal.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
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
  const url = new URL(req.url);
  if (url.searchParams.get("mode") === "deteksi") return remediasi(url, mulai);

  try {
    const generasi = await generateTerjadwal();
    const finalisasi = await finalisasiPeriodeSelesai();

    // Periodenya ditentukan WATERMARK, bukan oleh apa yang kebetulan terjadi
    // pada jalan ini. `periodeDifinalisasi` sengaja tidak lagi dipakai sebagai
    // pemicu: ia cuma menangkap periode yang ditutup HARI INI, sehingga periode
    // yang sudah `final` sebelum Phase 4 ada tidak pernah masuk lewat pintu
    // mana pun — itulah lubang yang membuat 180 pelanggaran Agustus senyap.
    // Lihat AD-15 dan `src/lib/ops/deteksi.ts`.
    const deteksi = await deteksiTerjadwal();

    // Kabar menyusul deteksi, dan SELALU sesudahnya: yang dikabarkan harus
    // sudah tersimpan. Kegagalannya tidak menggagalkan apa pun — Signal yang
    // sudah tercatat tetap sah walau kabarnya tidak terkirim, dan `notify()`
    // sendiri sudah menelan galatnya dengan alasan yang sama.
    const kabar = await kabarkanSignalCritical(deteksi.hasil.map((d) => d.periode));

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
        periode: deteksi.hasil.map((d) => d.periode),
        susulan: deteksi.rencana.susulan,
        dipotong: deteksi.rencana.dipotong,
        watermark_sebelum: deteksi.watermarkSebelum,
        watermark_sesudah: deteksi.watermarkSesudah,
        diperiksa: deteksi.hasil.reduce((n, d) => n + d.diperiksa, 0),
        layak: deteksi.hasil.reduce((n, d) => n + d.layak, 0),
        disisipkan: deteksi.hasil.reduce((n, d) => n + d.disisipkan, 0),
        diperbarui: deteksi.hasil.reduce((n, d) => n + d.diperbarui, 0),
        diamati_saja: deteksi.hasil.reduce((n, d) => n + d.diamatiSaja, 0),
      },
      // Sengaja dilaporkan terpisah dari deteksi: `terkirim` nol dengan
      // `kandidat` bukan nol berarti seluruhnya SUDAH pernah dikabarkan —
      // keadaan normal, bukan kegagalan. Menggabungkannya ke dalam angka
      // deteksi akan membuat keduanya tidak bisa dibedakan.
      notifikasi: {
        kandidat: kabar.kandidat,
        baru: kabar.baru,
        penerima: kabar.penerima,
        terkirim: kabar.terkirim,
      },
      msTotal: Date.now() - mulai,
    };
    await catatHasilSinkron({ "kpi-bulanan": ringkas });
    return NextResponse.json({ ok: true, tookMs: Date.now() - mulai, generasi, finalisasi, deteksi, notifikasi: kabar });
  } catch (e) {
    const pesan = e instanceof Error ? e.message : "gagal";
    console.error("[cron:kpi-bulanan] gagal:", pesan);
    await catatHasilSinkron({ "kpi-bulanan": { error: pesan } });
    return NextResponse.json({ ok: false, tookMs: Date.now() - mulai, error: pesan }, { status: 500 });
  }
}

/**
 * Deteksi satu periode historis yang terlewat — sekali jalan, terbatas.
 *
 * Jalurnya sama persis dengan deteksi terjadwal: `kondisiPeriode()` →
 * `evaluasi()` → `susunMuatan()` → `gwg_deteksi_signal`. Tidak ada mesin
 * penilai kedua, tidak ada status Signal baru, tidak ada jalan pintas yang
 * melewati gerbang `sumber_sah` maupun periode berlaku aturan.
 *
 * Watermark TIDAK digeser di sini. Remediasi menambal lubang di belakang;
 * watermark menjaga barisan di depan. Menggabungkannya akan membuat perbaikan
 * sekali pakai diam-diam melangkahi periode yang belum pernah dinilai.
 */
async function remediasi(url: URL, mulai: number): Promise<NextResponse> {
  const periode = url.searchParams.get("periode") ?? "";
  if (!bolehDiremediasi(periode)) {
    return NextResponse.json(
      { ok: false, error: `periode tidak diizinkan untuk remediasi: ${periode || "(kosong)"}`, diizinkan: REMEDIASI_DIIZINKAN },
      { status: 400 },
    );
  }

  const pratinjau = url.searchParams.get("pratinjau") === "1";
  try {
    if (pratinjau) {
      const hasil = await praDeteksi(periode);
      return NextResponse.json({ ok: true, mode: "pratinjau", tookMs: Date.now() - mulai, pratinjau: hasil });
    }

    const hasil = await deteksiSignal(periode);
    await catatHasilSinkron({ "kpi-bulanan-remediasi": { sisa: 0, ...hasil } });
    return NextResponse.json({ ok: true, mode: "remediasi", tookMs: Date.now() - mulai, deteksi: hasil });
  } catch (e) {
    const pesan = e instanceof Error ? e.message : "gagal";
    console.error("[cron:kpi-bulanan:remediasi] gagal:", pesan);
    await catatHasilSinkron({ "kpi-bulanan-remediasi": { error: pesan } });
    return NextResponse.json({ ok: false, mode: "remediasi", tookMs: Date.now() - mulai, error: pesan }, { status: 500 });
  }
}
