"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { kejarLubangDaily } from "@/lib/data/kejar-seasonal";
import { ambilKunciEsb, lepasKunciEsb } from "@/lib/data/esb-lock";
import { esbSetDeadline } from "@/lib/integrations/esb-client";
import { kelengkapanDaily } from "@/lib/data/kelengkapan-daily";

/**
 * KEJAR PENARIKAN DAILY DARI LAYAR, bukan lewat URL bertoken.
 *
 * Cron memang mengisi sendiri, tapi lubangnya belasan ribu dan jatah waktunya
 * cuma sisa anggaran sesudah pekerjaan lain — jadi kalau harus penuh hari ini
 * juga, harus ada yang menjalankannya bertubi-tubi.
 *
 * Jalan itu dulu cuma ada lewat `?token=` ke rute cron, dan tokennya tinggal di
 * basis data. Artinya yang ingin mengejar penarikan harus membuka basis data
 * untuk mengambil rahasia — persis kebiasaan yang paling tidak boleh
 * ditanamkan. Tombol ini menggantikannya: haknya diperiksa dari sesi yang sudah
 * masuk, tidak ada rahasia yang berpindah tangan.
 *
 * SEKALI PANGGIL = SATU JENDELA WAKTU, karena Vercel memutus permintaan di
 * detik ke-60. Yang berubah: satu jendela kini menarik ratusan hari, bukan
 * puluhan, dan layar memanggilnya berulang sendiri sampai penuh.
 */

export interface HasilKejar {
  /** Berapa cabang yang tersentuh jalan ini. */
  cabang: number;
  /** Berapa baris baru yang berhasil ditarik. */
  terisi: number;
  /** Panggilan ESB yang gagal — harinya tetap kosong, dicoba lagi nanti. */
  gagal: number;
  /** Berapa pasangan cabang×tanggal yang MASIH kurang sesudah jalan ini. */
  sisa: number;
  /** Persen lengkap sesudah jalan ini. */
  persen: number;
  /** Berapa panggilan berbarengan yang bertahan di akhir — turun kalau ESB mengerem. */
  konkuren: number;
  /** Benar bila jalan berikutnya masih ada gunanya. Layar memakai ini untuk
   *  memutuskan mengulang atau berhenti. */
  lanjut: boolean;
  /** Berapa milidetik layar sebaiknya menunggu sebelum memanggil lagi. Nol
   *  berarti langsung. Dipakai saat berpapasan dengan cron: memanggil lagi
   *  seketika hanya menambah rebutan kunci. */
  tunggu?: number;
  error?: string;
}

/** Anggaran satu jalan. Di bawah batas 60 detik Vercel, dengan sisa waktu untuk
 *  menghitung ulang kelengkapan dan membalas. */
const ANGGARAN_MS = 45_000;

/** Berapa lama menunggu kunci ESB sebelum menyerah. Cron yang sedang jalan
 *  biasanya lepas dalam hitungan detik; gagal seketika membuat pengejaran
 *  otomatis berhenti hanya karena kebetulan berpapasan. */
const TUNGGU_KUNCI_MS = 9_000;

/** Menunggu kunci ESB, bukan langsung menyerah saat berpapasan dengan cron. */
async function tungguKunci(): Promise<boolean> {
  const batas = Date.now() + TUNGGU_KUNCI_MS;
  for (;;) {
    if (await ambilKunciEsb(55_000)) return true;
    if (Date.now() >= batas) return false;
    await new Promise((r) => setTimeout(r, 1_500));
  }
}

export async function kejarDailyAction(): Promise<HasilKejar> {
  const user = await getSessionUser();
  if (!user || user.role !== "super_admin") {
    return { cabang: 0, terisi: 0, gagal: 0, sisa: 0, persen: 0, konkuren: 0, lanjut: false, error: "Hanya Admin yang dapat menjalankan penarikan." };
  }

  // Kunci yang sama dengan cron. Dua penarikan bersamaan saling merebut sesi
  // ESB, dan yang kalah tidak mendapat pesan yang jelas melainkan balasan yang
  // tidak bisa diuraikan — lalu bagiannya dilewati diam-diam.
  if (!(await tungguKunci())) {
    const k = await kelengkapanDaily();
    return {
      cabang: 0, terisi: 0, gagal: 0, sisa: k.kurang, persen: k.persen, konkuren: 0,
      // `lanjut` tetap benar: yang menghalangi cuma penarikan lain yang sedang
      // jalan, dan itu selesai sendiri. Berhenti di sini justru membatalkan
      // pengejaran otomatis karena satu papasan.
      lanjut: k.kurang > 0,
      tunggu: 15_000,
      error: "Ada penarikan ESB lain yang sedang jalan. Dicoba lagi sebentar lagi.",
    };
  }

  let terisi = 0;
  let gagal = 0;
  let konkuren = 0;
  let cabang = 0;
  let error: string | undefined;

  try {
    esbSetDeadline(ANGGARAN_MS);
    const r = await kejarLubangDaily(ANGGARAN_MS - 3_000);
    terisi = r.terisi;
    gagal = r.gagal;
    konkuren = r.konkuren;
    cabang = r.cabang;
    error = r.error;
  } catch (e) {
    error = e instanceof Error ? e.message : "Penarikan gagal.";
  } finally {
    await lepasKunciEsb();
  }

  const k = await kelengkapanDaily();
  revalidatePath("/admin/sinkron");
  revalidatePath("/operational/daily");
  return {
    cabang,
    terisi,
    gagal,
    sisa: k.kurang,
    persen: k.persen,
    konkuren,
    // Berhenti kalau sudah penuh, ATAU kalau satu jalan penuh tidak menghasilkan
    // apa pun — mengulang terus dalam keadaan itu cuma membebani ESB tanpa
    // menambah satu baris pun.
    lanjut: k.kurang > 0 && terisi > 0,
    error,
  };
}
