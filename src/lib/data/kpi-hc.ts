import "server-only";

import { db, dbEnabled } from "./db";
import { DEPARTEMEN, POSISI } from "@/lib/kpi/struktur";
import { SEMUA_PIC } from "@/lib/kpi/semua-pic";

/**
 * Dua angka KPI Human Capital yang dihitung sendiri oleh sistem.
 *
 * Empat indikator lainnya diketik manual — probation, pelatihan, jumlah dan
 * waktu rekrutmen belum punya tempat pencatatan yang dipakai orang, dan
 * memaksanya otomatis berarti menampilkan nol setiap bulan untuk pekerjaan
 * yang sebenarnya berjalan.
 */

/** Departemen yang TIDAK ikut dirata-rata: Human Capital sendiri. */
const DEP_HC = "hrd";

/**
 * Manajemen Kinerja — rata-rata capaian seluruh departemen SELAIN Human Capital.
 *
 * HC dikeluarkan bukan sebagai kelonggaran, melainkan karena ikut menghitung
 * dirinya sendiri berarti nilai HC menjadi bahan untuk menghitung nilai HC —
 * berputar tanpa ujung, dan halaman KPI-nya tidak akan pernah selesai dimuat.
 *
 * Dirata-rata PER DEPARTEMEN, bukan per posisi: departemen berisi satu orang
 * dan departemen berisi enam orang sama beratnya, sesuai maksud pengukurannya.
 */
export async function rataDepartemenLain(periode: string): Promise<number | null> {
  const { laporanKpi } = await import("./kpi");
  const dipakai = POSISI.filter((p) => !DEPARTEMEN.find((d) => d.kode === DEP_HC)?.posisi.includes(p.kode));

  // Satu posisi yang gagal dibaca tidak boleh menjatuhkan seluruh angkanya —
  // yang lain tetap terhitung, dan yang gagal dianggap belum terukur.
  const laporan = await Promise.all(
    dipakai.map((p) => laporanKpi(p.kode, periode, p.perPic ? SEMUA_PIC : "").catch(() => null)),
  );

  const skor = new Map<string, number>();
  laporan.forEach((l, i) => {
    const nilai = l?.ringkas.skorSetara ?? null;
    if (nilai !== null) skor.set(dipakai[i].kode, nilai);
  });

  const rataDep: number[] = [];
  for (const d of DEPARTEMEN) {
    if (d.kode === DEP_HC) continue;
    const nilai = d.posisi.map((k) => skor.get(k)).filter((n): n is number => n !== undefined);
    if (nilai.length) rataDep.push(nilai.reduce((a, b) => a + b, 0) / nilai.length);
  }
  if (rataDep.length === 0) return null;
  return rataDep.reduce((a, b) => a + b, 0) / rataDep.length;
}

/**
 * Administrasi Personalia — dokumen Antrian Dokumen yang SELESAI di bulan itu.
 *
 * Dihitung dari `completed_at`, bukan dari tanggal pengajuan: yang diukur
 * pekerjaan HC menyelesaikannya, dan dokumen yang masuk akhir Agustus lalu
 * selesai awal September adalah hasil kerja September.
 */
export async function dokumenSelesai(periode: string): Promise<number | null> {
  if (!dbEnabled) return null;
  const [y, m] = periode.split("-").map(Number);
  if (!y || !m) return null;
  const mulai = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const habis = new Date(Date.UTC(y, m, 1)).toISOString();

  const { count, error } = await db()
    .from("hc_submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "done")
    .gte("completed_at", mulai)
    .lt("completed_at", habis);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
