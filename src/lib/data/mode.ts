/**
 * Mode data aplikasi — dan kapan data contoh BOLEH disajikan.
 *
 * Aplikasi ini punya kumpulan data contoh di memori (`seed.ts`): 59 orang
 * dengan nama yang dikarang acak, lengkap dengan outlet, pengajuan, dan angka
 * penilaiannya. Gunanya membaca kode dan menggarap tampilan tanpa menyiapkan
 * basis data apa pun.
 *
 * Yang membuatnya berbahaya: dulu data itu muncul DIAM-DIAM. Begitu
 * `GWG_SUPABASE_URL` atau kuncinya tidak terbaca, aplikasi tidak mengeluh —
 * ia langsung menyajikan 59 orang karangan itu seolah data perusahaan. Layarnya
 * sama persis dengan layar sungguhan: sidebar sama, menu sama, tabel sama.
 * Tidak ada satu pun tanda bahwa yang sedang dilihat bukan kenyataan.
 *
 * Itu bukan kekhawatiran teoretis. Pemilik sistem ini pernah membuka sebuah
 * deployment Preview, melihat User Management berisi nama-nama yang tidak ia
 * kenal, dan menyimpulkan seluruh datanya terhapus. Bahaya yang lebih besar
 * adalah kebalikannya: seseorang PERCAYA angka karangan itu, lalu memutuskan
 * sesuatu dari situ.
 *
 * Karena itu aturannya dibalik. Data contoh sekarang harus DIIZINKAN, bukan
 * sekadar terjadi:
 *
 *   • `next dev` di komputer sendiri — diizinkan, memang untuk itu.
 *   • Build produksi dengan `GWG_DEMO=1` — diizinkan, seseorang memintanya
 *     secara sadar (peragaan, uji tampilan).
 *   • Selain itu — DITOLAK. Halamannya diganti keterangan apa yang kurang,
 *     bukan data karangan.
 *
 * Menolak melayani memang membuat halamannya tidak bisa dibuka. Itu memang
 * maksudnya: halaman yang tidak bisa dibuka menyuruh orang memperbaiki
 * konfigurasinya, sedangkan halaman berisi data karangan menyuruhnya percaya.
 */

export type ModeData =
  /** Terhubung ke Supabase — data sungguhan. */
  | "basis-data"
  /** Data contoh, dan itu memang disengaja. */
  | "demo"
  /** Tidak ada basis data dan demo tidak diizinkan — jangan sajikan apa pun. */
  | "tanpa-basis-data";

export interface KeadaanLingkungan {
  /** `GWG_SUPABASE_URL` dan kuncinya terbaca. */
  dbAktif: boolean;
  /** Berjalan lewat `next dev`, bukan build produksi. */
  pengembangan: boolean;
  /** `GWG_DEMO=1` — izin sadar untuk menyajikan data contoh. */
  demoDiizinkan: boolean;
}

export function modeData(k: KeadaanLingkungan): ModeData {
  if (k.dbAktif) return "basis-data";
  if (k.pengembangan || k.demoDiizinkan) return "demo";
  return "tanpa-basis-data";
}

/** Halaman aplikasi boleh dirender? */
export const bolehMelayani = (m: ModeData): boolean => m !== "tanpa-basis-data";

/**
 * Perlu diberi tanda bahwa isinya karangan?
 *
 * Ya, bahkan saat demo memang disengaja. Yang menjalankan tahu apa yang ia
 * jalankan; yang dikirimi tautannya belum tentu.
 */
export const perluTandaDemo = (m: ModeData): boolean => m === "demo";

/** Variabel yang hilang — ditampilkan apa adanya, tanpa menyebut nilainya. */
export function variabelKurang(env: {
  GWG_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  GWG_SUPABASE_KEY?: string;
}): string[] {
  const kurang: string[] = [];
  if (!env.GWG_SUPABASE_URL) kurang.push("GWG_SUPABASE_URL");
  // Salah satu saja cukup; menyebut keduanya sebagai wajib akan menyesatkan.
  if (!env.SUPABASE_SERVICE_ROLE_KEY && !env.GWG_SUPABASE_KEY) {
    kurang.push("SUPABASE_SERVICE_ROLE_KEY (atau GWG_SUPABASE_KEY)");
  }
  return kurang;
}
