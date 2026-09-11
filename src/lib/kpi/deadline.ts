/**
 * Pilihan tenggat pengajuan desain — dan harganya di KPI.
 *
 * YANG DINILAI DUA PIHAK SEKALIGUS. Bagi tim Creative, tenggat panjang berarti
 * tidak ada alasan terlambat: gagal menepatinya MENGURANGI skor, dan menepatinya
 * hanya berarti tidak berkurang. Tenggat pendek sebaliknya — gagal tidak
 * menghukum, karena yang meminta sendiri yang menyisakan waktu terlalu sempit,
 * sedangkan berhasil menepatinya MENAMBAH skor.
 *
 * Bagi yang meminta, pilihannya ikut tercatat. Supervisor yang terus-menerus
 * meminta H-1 akan terlihat di rapotnya sendiri, tanpa siapa pun perlu
 * mengingat-ingat.
 */
export type KategoriTenggat = "sebelum_h5" | "h5" | "h3" | "h1";

export interface AturanTenggat {
  kategori: KategoriTenggat;
  label: string;
  /** Berapa hari setelah tanggal permintaan tenggatnya jatuh. */
  hari: number;
  /** Nilai bila LEWAT tenggat — nol atau minus. */
  gagal: number;
  /** Nilai bila selesai tepat waktu — nol atau plus. */
  selesai: number;
  keterangan: string;
}

/**
 * "Sebelum H-5" berjarak ENAM hari, ditetapkan pemiliknya.
 *
 * Kategorinya sendiri tidak menyebut jarak pasti — "sebelum H-5" hanya berarti
 * lebih longgar daripada H-5. Angkanya perlu ditetapkan supaya tanggal
 * tenggatnya terisi otomatis dan tidak ada yang mengetiknya sendiri-sendiri;
 * enam hari yang dipilih, dan terlambat di situ tetap mengurangi.
 */
export const TENGGAT: AturanTenggat[] = [
  {
    kategori: "sebelum_h5",
    label: "Sebelum H-5",
    hari: 6,
    gagal: -3,
    selesai: 0,
    keterangan: "Waktunya paling longgar — terlambat di sini paling mahal.",
  },
  { kategori: "h5", label: "H-5", hari: 5, gagal: -2, selesai: 0, keterangan: "Masih cukup waktu; terlambat tetap mengurangi." },
  { kategori: "h3", label: "H-3", hari: 3, gagal: 0, selesai: 2, keterangan: "Waktunya sempit — selesai tepat waktu bernilai tambah." },
  { kategori: "h1", label: "H-1", hari: 1, gagal: 0, selesai: 3, keterangan: "Mendesak. Terlambat tidak menghukum, selesai bernilai paling besar." },
];

export const aturanTenggat = (k: string): AturanTenggat | undefined => TENGGAT.find((t) => t.kategori === k);

export const labelTenggat = (k: string | null): string => (k ? (aturanTenggat(k)?.label ?? k) : "—");

/** Tanggal tenggat dari tanggal permintaan — "YYYY-MM-DD" masuk, "YYYY-MM-DD" keluar. */
export function tanggalTenggat(tanggalRequest: string, kategori: string): string | null {
  const aturan = aturanTenggat(kategori);
  if (!aturan || !/^\d{4}-\d{2}-\d{2}$/.test(tanggalRequest)) return null;
  const [th, bl, tg] = tanggalRequest.split("-").map(Number);
  const d = new Date(Date.UTC(th, bl - 1, tg + aturan.hari));
  return d.toISOString().slice(0, 10);
}

/**
 * Nilai satu permintaan bagi tim Creative.
 *
 * Permintaan yang BELUM selesai dan belum lewat tenggat belum bernilai apa pun —
 * ia masih punya waktu, dan menghitungnya sebagai gagal berarti menghukum
 * pekerjaan yang sedang berjalan.
 */
export function nilaiTenggat(input: {
  kategori: string | null;
  tenggat: string | null;
  selesaiPada: string | null;
  /** Tanggal hari ini, "YYYY-MM-DD" — untuk menilai yang belum selesai. */
  hariIni: string;
}): number | null {
  const aturan = input.kategori ? aturanTenggat(input.kategori) : undefined;
  if (!aturan || !input.tenggat) return null;
  if (input.selesaiPada) return input.selesaiPada.slice(0, 10) <= input.tenggat ? aturan.selesai : aturan.gagal;
  return input.hariIni > input.tenggat ? aturan.gagal : null;
}

/** Permintaan ini sudah lewat tenggat? */
export function lewatTenggat(input: { tenggat: string | null; selesaiPada: string | null; hariIni: string }): boolean {
  if (!input.tenggat) return false;
  return input.selesaiPada ? input.selesaiPada.slice(0, 10) > input.tenggat : input.hariIni > input.tenggat;
}

/**
 * Jarak antara tenggat desain dan tanggal tayangnya: TIGA HARI.
 *
 * Ditetapkan pemiliknya lewat contohnya sendiri — tayang tanggal 20 berarti
 * tenggat tanggal 17. (Sebelumnya satu hari; diubah atas permintaannya.)
 *
 * Tiga hari, bukan satu, karena materi konten tidak selesai saat desainnya
 * jadi: masih ada penulisan caption, penjadwalan, dan koreksi kalau ada yang
 * keliru. Satu hari jeda hanya cukup untuk menyerahkan berkasnya, tidak untuk
 * memperbaikinya.
 */
export const JEDA_TENGGAT_UPLOAD = 3;

/**
 * Tenggat desain dari tanggal tayang: mundur {@link JEDA_TENGGAT_UPLOAD} hari.
 *
 * Dipakai pengajuan Sosial Media, yang mengisi TANGGAL TAYANG alih-alih memilih
 * kelonggaran. Materinya sudah punya tanggal pasti di kalender konten; menyuruh
 * pemohonnya memilih "H-5" atau "H-3" berarti menerjemahkan tanggal yang sudah
 * pasti jadi tebakan, lalu menerjemahkannya balik jadi tanggal lagi.
 */
export function tenggatDariRencanaUpload(rencanaUpload: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rencanaUpload)) return null;
  const [th, bl, tg] = rencanaUpload.split("-").map(Number);
  return new Date(Date.UTC(th, bl - 1, tg - JEDA_TENGGAT_UPLOAD)).toISOString().slice(0, 10);
}
