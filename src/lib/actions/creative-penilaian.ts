"use server";

import { getSessionUser } from "@/lib/auth";
import { dbEnabled } from "@/lib/data/db";
import { openDirectThread, sendMessage } from "@/lib/data/chat";
import { getUsers } from "@/lib/data/store";
import { notify } from "@/lib/data/notify";
import { areaTerlihat, barisUntukLaporan, penerimaLaporan } from "@/lib/data/creative-penilaian";
import { susunLaporan, judulLaporan } from "@/lib/creative/laporan-penilaian";
import { dalamPeriode, rekapArea } from "@/lib/creative/penilaian-request";
import { bolehKirimLaporanPenilaian, bolehLihatSemuaArea } from "@/lib/creative/akses";

/**
 * Kirim laporan penilaian ke Coordinator Area.
 *
 * ANGKANYA DIHITUNG ULANG DI SINI, bukan diterima dari layar. Layar hanya
 * mengirim periode dan siapa penerimanya. Kalau angkanya ikut dikirim, siapa
 * pun yang bisa memanggil aksi ini bisa mengarang rapor atas nama orang lain —
 * dan laporan yang bisa dikarang tidak layak jadi bahan evaluasi siapa pun.
 *
 * SETIAP CA MENERIMA WILAYAHNYA SENDIRI. Mengirim seluruh tabel ke semua orang
 * memang lebih mudah, tapi yang sampai ke tangan seorang CA jadi rapor wilayah
 * rekannya juga — dan alat evaluasi yang bocor ke samping berhenti dipakai
 * sebagai alat evaluasi.
 */
export async function kirimLaporanPenilaianAction(input: {
  periode: string;
  penerimaIds: string[];
  catatan?: string;
}): Promise<{ terkirim?: number; error?: string }> {
  const user = await getSessionUser();
  if (!user || !dbEnabled) return { error: "Tidak punya akses." };
  if (!bolehKirimLaporanPenilaian(user)) return { error: "Hanya tim Creative yang boleh mengirim laporan ini." };
  if (input.penerimaIds.length === 0) return { error: "Pilih dulu Coordinator Area yang dituju." };

  const semuaCa = penerimaLaporan(getUsers());
  const dituju = semuaCa.filter((c) => input.penerimaIds.includes(c.id));
  if (dituju.length === 0) return { error: "Penerima tidak dikenali sebagai Coordinator Area." };

  const baris = await barisUntukLaporan(areaTerlihat(user, bolehLihatSemuaArea(user)));
  const periodeBaris = dalamPeriode(baris, input.periode);
  const catatan = (input.catatan ?? "").slice(0, 500);

  let terkirim = 0;
  for (const ca of dituju) {
    // Wilayah yang dipegangnya saja. CA tanpa cabang tidak dikirimi apa pun:
    // pesan berisi "0 permintaan" tidak memberitahunya apa-apa selain bahwa
    // penugasan cabangnya belum diisi.
    const miliknya = rekapArea(periodeBaris.filter((b) => ca.areaIds.includes(b.areaId)));
    if (miliknya.length === 0) continue;

    const naskah = susunLaporan({
      periode: input.periode,
      area: miliknya,
      catatan,
      pengirim: user.name,
    });

    try {
      const threadId = await openDirectThread(user.id, ca.id);
      const res = await sendMessage({ threadId, senderId: user.id, body: naskah });
      if (res.error) continue;
      terkirim += 1;
      // Notifikasi terpisah supaya laporannya punya tautan langsung ke
      // dashboard-nya; pesan chat hanya membawa teksnya.
      await notify({
        kind: "creative_report",
        title: judulLaporan(input.periode),
        message: `${user.name} mengirim penilaian permintaan design di wilayah Anda.`,
        href: "/creative/penilaian",
        targetUser: ca.id,
        actorName: user.name,
        severity: "warning",
      });
    } catch {
      // Satu penerima gagal tidak boleh membatalkan sisanya.
    }
  }

  if (terkirim === 0) return { error: "Tidak ada laporan yang bisa dikirim — wilayah penerimanya belum punya penilaian." };
  return { terkirim };
}
