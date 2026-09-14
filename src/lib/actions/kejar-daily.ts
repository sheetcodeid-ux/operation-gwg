"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { syncSeasonalDays, getSeasonalBranches } from "@/lib/data/seasonal";
import { getAppConfig, setAppConfig } from "@/lib/data/app-config";
import { ambilKunciEsb, lepasKunciEsb } from "@/lib/data/esb-lock";
import { esbSetDeadline } from "@/lib/integrations/esb-client";
import { kelengkapanDaily } from "@/lib/data/kelengkapan-daily";

/**
 * KEJAR PENARIKAN DAILY DARI LAYAR, bukan lewat URL bertoken.
 *
 * Cron per jam memang mengisi sendiri, tapi lubangnya belasan ribu dan ESB
 * hanya melayani satu panggilan pada satu waktu — jadi kalau harus penuh hari
 * ini juga, satu-satunya jalan adalah menjalankannya berkali-kali.
 *
 * Jalan itu dulu cuma ada lewat `?token=` ke rute cron, dan tokennya tinggal
 * di basis data. Artinya yang ingin mengejar penarikan harus membuka basis
 * data untuk mengambil rahasia — persis kebiasaan yang paling tidak boleh
 * ditanamkan. Tombol ini menggantikannya: haknya diperiksa dari sesi yang
 * sudah masuk, tidak ada rahasia yang berpindah tangan.
 *
 * SEKALI PENCET = SATU JENDELA WAKTU. Dipencet lagi, lanjut dari tempatnya
 * berhenti. `sisa` yang pulang memberi tahu kapan berhenti memencet.
 */

export interface HasilKejar {
  /** Berapa cabang yang sempat disentuh jalan ini. */
  cabang: number;
  /** Berapa baris baru yang berhasil ditarik. */
  terisi: number;
  /** Berapa pasangan cabang×tanggal yang MASIH kurang sesudah jalan ini. */
  sisa: number;
  /** Persen lengkap sesudah jalan ini. */
  persen: number;
  error?: string;
}

/** Anggaran satu jalan. Di bawah batas 60 detik Vercel, dengan sisa waktu
 *  untuk menghitung ulang kelengkapan dan membalas. */
const ANGGARAN_MS = 40_000;

export async function kejarDailyAction(): Promise<HasilKejar> {
  const user = await getSessionUser();
  if (!user || user.role !== "super_admin") {
    return { cabang: 0, terisi: 0, sisa: 0, persen: 0, error: "Hanya Admin yang dapat menjalankan penarikan." };
  }

  // Kunci yang sama dengan cron. Dua penarikan bersamaan saling merebut sesi
  // ESB, dan yang kalah tidak mendapat pesan yang jelas melainkan balasan yang
  // tidak bisa diuraikan — lalu bagiannya dilewati diam-diam.
  if (!(await ambilKunciEsb(60_000))) {
    const k = await kelengkapanDaily();
    return {
      cabang: 0, terisi: 0, sisa: k.kurang, persen: k.persen,
      error: "Ada penarikan ESB lain yang sedang jalan. Coba lagi sebentar lagi.",
    };
  }

  const mulai = Date.now();
  const sisaWaktu = () => ANGGARAN_MS - (Date.now() - mulai);
  let cabangDisentuh = 0;
  let terisi = 0;
  let error: string | undefined;

  try {
    esbSetDeadline(sisaWaktu());
    const branches = await getSeasonalBranches();
    if (branches.length === 0) {
      error = "Daftar cabang ESB tidak terbaca.";
    } else {
      let cur = Number((await getAppConfig("seasonal_branch_cursor")) ?? "0") || 0;
      const th = new Date(Date.now() + 7 * 3_600_000).getUTCFullYear();
      const hariIni = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
      // Berhenti sesudah satu putaran penuh: kalau semuanya sudah lengkap,
      // memutar lagi hanya membaca ulang tanpa menambah apa pun.
      while (sisaWaktu() > 6_000 && cabangDisentuh < branches.length) {
        const b = branches[cur % branches.length];
        const r = await syncSeasonalDays(`${th}-01-01`, hariIni, b.id, Math.min(sisaWaktu() - 4_000, 20_000));
        cur += 1;
        cabangDisentuh += 1;
        terisi += r.synced;
        if (r.error) { error = r.error; break; }
      }
      await setAppConfig("seasonal_branch_cursor", String(cur));
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Penarikan gagal.";
  } finally {
    await lepasKunciEsb();
  }

  const k = await kelengkapanDaily();
  revalidatePath("/admin/sinkron");
  revalidatePath("/operational/daily");
  return { cabang: cabangDisentuh, terisi, sisa: k.kurang, persen: k.persen, error };
}
