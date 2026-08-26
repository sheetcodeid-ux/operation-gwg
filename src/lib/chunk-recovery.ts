"use client";

/**
 * Pemulihan dari halaman versi lama setelah aplikasi diperbarui.
 *
 * Setelah deploy, peramban yang MASIH memegang kerangka halaman lama menunjuk
 * berkas-berkas yang namanya sudah berganti di CDN. Ada DUA cara kegagalannya
 * muncul, dan sebelumnya hanya yang pertama ditangani:
 *
 *  1. Impor dinamis gagal — ChunkLoadError. Batas galat terdekat tampil, dan
 *     "restart" lunak tidak menolong karena kerangka yang tersimpan memuat
 *     berkas mati yang sama. Hanya muat ulang keras yang mengambil kerangka
 *     baru.
 *
 *  2. SERVER ACTION dipanggil dengan id milik build lama. Server tidak
 *     mengenalinya, dan yang sampai ke pengguna hanyalah "An error occurred in
 *     the Server Components render. The specific message is omitted in
 *     production builds" — kalimat yang tidak menyebut apa pun tentang versi,
 *     tidak memberi jalan keluar, dan membuat orang menekan tombolnya
 *     berulang-ulang karena tampak seperti gangguan acak.
 *
 * Kasus kedua ini yang membuat satu supervisor tidak bisa mengirim Pengajuan
 * Dokumen berhari-hari sementara supervisor lain lancar: bedanya bukan akun
 * maupun isian, melainkan tabnya yang tidak pernah ditutup sejak deploy
 * terakhir. Aplikasi ini dipasang sebagai PWA, jadi tab seperti itu biasa
 * berumur berhari-hari.
 *
 * Muat ulang dilakukan SEKALI, dijaga penanda di sessionStorage supaya tidak
 * mungkin berputar (kalau setelah dimuat ulang masih gagal, jatuh ke tampilan
 * galat biasa).
 */

const RELOAD_FLAG = "gwg_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 20_000;

const CHUNK_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk [\w-]+ failed/i,
  /Loading CSS chunk/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /Failed to load resource.*\.js/i,
];

/**
 * Tanda server action dipanggil dari kerangka halaman versi lama.
 *
 * Daftar ini pernah memuat "An error occurred in the Server Components render"
 * dan itu KELIRU. Kalimat itu adalah pesan bawaan Next untuk SETIAP kegagalan
 * sisi server di build produksi — bukan penanda versi. Memperlakukannya sebagai
 * versi basi membuat aplikasi memuat ulang halaman pada kegagalan apa pun,
 * dan formulir yang sudah diisi belasan baris hilang begitu saja. Bagi yang
 * mengisinya, itu lebih buruk daripada galat aslinya: sebelumnya ia melihat
 * pesan yang tidak berguna, sesudahnya ia kehilangan pekerjaannya juga.
 *
 * Yang tersisa di sini hanya penanda yang benar-benar khas versi basi.
 */
const VERSI_PATTERNS = [
  /Failed to find Server Action/i,
  /the server action was not found/i,
  /Invalid Server Actions request/i,
];

/** Whether an error looks like a stale-chunk / dynamic-import failure. */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const err = error as { name?: string; message?: string };
  if (err.name === "ChunkLoadError") return true;
  const msg = String(err.message ?? error);
  return CHUNK_PATTERNS.some((re) => re.test(msg));
}

/**
 * Galat urutan hook React — #300, #301, #310.
 *
 * Jejak produksinya menunjuk ke dalam Router App milik Next sendiri: hook yang
 * meledak adalah `useMemo` tepat sesudah `useActionQueue`, bukan hook di
 * komponen mana pun milik kita. Pemeriksa aturan hook memang tidak menemukan
 * apa-apa di kode kita — memang tidak ada.
 *
 * Yang bisa kita kerjakan bukan mencegahnya, melainkan berhenti meninggalkan
 * orang di layar mati. Render pohonnya sudah gagal, jadi `reset()` menyusun
 * ulang pohon yang sama dan gagal lagi; hanya muat ulang keras yang memulai
 * dari awal. Aman dilakukan DARI BATAS GALAT karena di titik itu halamannya
 * sudah mogok — tidak ada isian yang bisa hilang, sudah hilang lebih dulu.
 */
const HOOK_PATTERNS = [
  /Minified React error #3(00|01|10)\b/i,
  /Rendered more hooks than during the previous render/i,
  /Rendered fewer hooks than expected/i,
  /Should have a queue\./i,
];

export function isGalatUrutanHook(error: unknown): boolean {
  if (!error) return false;
  const msg = String((error as { message?: string })?.message ?? error);
  return HOOK_PATTERNS.some((re) => re.test(msg));
}

/** Apakah galat ini berarti "halaman yang Anda pegang versi lama"? */
export function isVersiBasi(error: unknown): boolean {
  if (!error) return false;
  if (isChunkLoadError(error)) return true;
  const msg = String((error as { message?: string })?.message ?? error);
  return VERSI_PATTERNS.some((re) => re.test(msg));
}

/**
 * Muat ulang keras SEKALI untuk galat yang memang hanya bisa dipulihkan begitu.
 *
 * Dua kelas: halaman versi lama, dan galat urutan hook React. Keduanya membuat
 * `reset()` tidak berguna — yang pertama karena berkasnya sudah tidak ada di
 * CDN, yang kedua karena pohon yang sama akan gagal lagi.
 *
 * Dipanggil dari batas galat, tempat halamannya memang sudah mogok. Penjaga
 * sessionStorage memastikan ia tidak mungkin berputar: kalau setelah dimuat
 * ulang masih gagal, tampilan galat biasa yang muncul.
 */
export function recoverFromChunkError(error: unknown): void {
  if (typeof window === "undefined") return;
  if (!isVersiBasi(error) && !isGalatUrutanHook(error)) return;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return; // already tried — avoid a loop
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    /* sessionStorage blocked (private mode) — fall through and still reload once */
  }
  window.location.reload();
}

/**
 * Pesan yang layak dibaca untuk galat server action, plus pemulihannya.
 *
 * Dipakai komponen klien yang memanggil aksi dari dalam formulir. Dua hal
 * terjadi sekaligus: pengguna diberi tahu apa yang sebenarnya terjadi, dan
 * kalau sebabnya versi basi, halamannya dimuat ulang sesaat kemudian supaya
 * percobaan berikutnya memakai versi yang benar — tanpa itu, menekan tombolnya
 * lagi pasti gagal lagi, persis seperti yang selama ini terjadi.
 */
export function pesanGalatAksi(error: unknown): string {
  if (isVersiBasi(error)) {
    if (typeof window !== "undefined") {
      // Diberi jeda supaya pesannya sempat terbaca. Muat ulangnya sendiri tetap
      // lewat penjaga yang sama, jadi tidak mungkin berputar.
      window.setTimeout(() => recoverFromChunkError(error), 2500);
    }
    return "Aplikasi baru saja diperbarui, halaman ini masih versi lama. Halaman dimuat ulang sebentar lagi — silakan kirim ulang setelah itu.";
  }

  // Pesan bawaan Next untuk kegagalan sisi server di produksi. Isinya memang
  // disunting, jadi tidak ada gunanya diteruskan apa adanya — yang berguna bagi
  // yang membacanya adalah bahwa ISIANNYA MASIH ADA dan tombolnya boleh ditekan
  // lagi. Halaman TIDAK dimuat ulang: satu-satunya salinan pekerjaannya ada di
  // formulir itu.
  const pesan = error instanceof Error ? error.message : String(error ?? "");
  if (/An error occurred in the Server Components render|Connection closed/i.test(pesan)) {
    return "Server menolak pengirimannya. Isian Anda masih utuh — tekan Kirim sekali lagi. Kalau tetap gagal, coba hapus lampiran KTP-nya dulu lalu kirim, dan laporkan lewat IT Help Desk.";
  }
  return pesan || "Gagal mengirim. Isian Anda masih utuh — coba tekan Kirim sekali lagi.";
}
