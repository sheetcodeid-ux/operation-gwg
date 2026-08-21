/**
 * Compensation & Benefit — perhitungan untuk Attendance & Cuti, Payroll, dan
 * BPJS & Benefit.
 *
 * Semuanya murni: masuk baris, keluar angka. Tidak menyentuh basis data dan
 * tidak tahu soal React, supaya bisa diuji tanpa merender apa pun — dan supaya
 * angka yang muncul di layar tidak lahir di dalam komponen, tempat kekeliruan
 * hitung paling sulit terlihat.
 */

export type StatusProses = "proses" | "selesai";

/* ─────────────────────────── Attendance & Cuti ─────────────────────────── */

export interface BarisCuti {
  nama: string;
  divisi: string;
  scope: string;
  jenis: string;
  status: string;
  mulai: string | null;
  selesai: string | null;
}

const hariDari = (iso: string | null): number | null => {
  if (!iso) return null;
  const w = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(w) ? null : w;
};

/**
 * Cuti/izin yang sedang berjalan pada suatu tanggal.
 *
 * Hanya yang SUDAH DISETUJUI yang dihitung. Pengajuan yang masih menunggu
 * belum mengurangi kehadiran siapa pun — orangnya masih masuk kerja sampai
 * atasannya memutuskan, dan menghitungnya lebih awal membuat angka kehadiran
 * turun karena sesuatu yang belum terjadi.
 */
export function cutiAktif<T extends BarisCuti>(rows: T[], tanggal: string): T[] {
  const kini = hariDari(tanggal);
  if (kini === null) return [];
  return rows.filter((r) => {
    if (r.status !== "disetujui") return false;
    const a = hariDari(r.mulai);
    const b = hariDari(r.selesai);
    if (a === null) return false;
    return kini >= a && kini <= (b ?? a);
  });
}

/**
 * Persentase kehadiran hari ini.
 *
 * Penyebutnya jumlah karyawan yang terpantau, BUKAN jumlah baris cuti — kalau
 * penyebutnya diambil dari tabel cuti, hari tanpa satu pun pengajuan akan
 * terbaca 0% padahal artinya justru semua orang masuk.
 */
export function persenKehadiran(totalKaryawan: number, sedangCuti: number): number {
  if (totalKaryawan <= 0) return 0;
  const hadir = Math.max(0, totalKaryawan - sedangCuti);
  return Math.round((hadir / totalKaryawan) * 100);
}

/* ─────────────────────────────── Payroll ─────────────────────────────── */

export interface BarisPayroll {
  nama: string;
  scope: string;
  periode: string;
  sumber: string;
  outletName: string | null;
  status: string;
}

export interface KelompokPayroll {
  nama: string;
  jumlah: number;
  status: StatusProses;
}

/** Periode payroll yang baru saja dibayarkan, dalam format `2026-07`. */
export function periodeBulanLalu(sekarang: Date): string {
  const t = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth() - 1, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Rekap payroll satu periode, dikelompokkan menurut kunci yang diberikan
 * pemanggil — sumber (Office/Warehouse) untuk manajemen, brand untuk outlet.
 *
 * Status kelompok DITURUNKAN, tidak disimpan: satu kelompok baru "selesai"
 * kalau seluruh barisnya selesai. Menyimpannya sebagai kolom tersendiri berarti
 * ada dua kebenaran yang bisa berbeda — kelompok bertanda selesai sementara
 * masih ada baris yang menggantung di dalamnya.
 */
export function rekapPayroll(
  rows: BarisPayroll[],
  periode: string,
  kunci: (r: BarisPayroll) => string,
): KelompokPayroll[] {
  const peta = new Map<string, { jumlah: number; selesai: number }>();
  for (const r of rows) {
    if (r.periode !== periode) continue;
    const k = kunci(r) || "Lainnya";
    const p = peta.get(k) ?? { jumlah: 0, selesai: 0 };
    p.jumlah += 1;
    if (r.status === "selesai") p.selesai += 1;
    peta.set(k, p);
  }
  return [...peta.entries()]
    .map(([nama, p]) => ({
      nama,
      jumlah: p.jumlah,
      status: (p.selesai === p.jumlah ? "selesai" : "proses") as StatusProses,
    }))
    .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama));
}

/* ───────────────────────────── BPJS & Benefit ───────────────────────────── */

export interface BarisBpjs {
  nama: string;
  scope: string;
  tk: string;
  kes: string;
  tglMasuk: string | null;
}

export interface RekapBpjs {
  total: number;
  tkSelesai: number;
  kesSelesai: number;
  keduanya: number;
  belumSamaSekali: number;
}

const sudah = (v: string) => v === "terdaftar";

/**
 * Empat angka yang ditanyakan Human Capital tiap bulan: berapa yang BPJS
 * Ketenagakerjaannya beres, berapa yang Kesehatannya beres, berapa yang
 * dua-duanya, dan berapa yang belum tersentuh sama sekali.
 *
 * Yang terakhir itu yang paling penting — orang yang hanya kurang satu program
 * masih terlindungi sebagian, sedangkan yang belum terdaftar sama sekali tidak
 * terlindungi apa pun. Dua kelompok itu tidak boleh tercampur dalam satu angka.
 */
export function rekapBpjs(rows: BarisBpjs[]): RekapBpjs {
  return rows.reduce<RekapBpjs>(
    (a, r) => ({
      total: a.total + 1,
      tkSelesai: a.tkSelesai + (sudah(r.tk) ? 1 : 0),
      kesSelesai: a.kesSelesai + (sudah(r.kes) ? 1 : 0),
      keduanya: a.keduanya + (sudah(r.tk) && sudah(r.kes) ? 1 : 0),
      belumSamaSekali: a.belumSamaSekali + (!sudah(r.tk) && !sudah(r.kes) ? 1 : 0),
    }),
    { total: 0, tkSelesai: 0, kesSelesai: 0, keduanya: 0, belumSamaSekali: 0 },
  );
}

/** Karyawan yang belum terdaftar di kedua program — prioritas tindak lanjut. */
export const belumTerdaftarKeduanya = <T extends BarisBpjs>(rows: T[]): T[] =>
  rows.filter((r) => !sudah(r.tk) && !sudah(r.kes));

/**
 * Masa kerja dalam kalimat, bukan jumlah hari.
 *
 * "1027 hari" benar tapi tidak menjawab pertanyaan yang sebenarnya diajukan
 * pembacanya — apakah orang ini sudah cukup lama untuk didahulukan. "2 Tahun 9
 * Bulan" menjawabnya seketika.
 */
export function masaKerja(tglMasuk: string | null, sekarang: Date): string {
  const mulai = tglMasuk ? new Date(`${tglMasuk.slice(0, 10)}T00:00:00Z`) : null;
  if (!mulai || Number.isNaN(mulai.getTime())) return "—";

  const kini = new Date(Date.UTC(sekarang.getUTCFullYear(), sekarang.getUTCMonth(), sekarang.getUTCDate()));
  if (mulai.getTime() > kini.getTime()) return "Karyawan baru";

  // Dihitung dengan MELANGKAH bulan penuh dulu, lalu sisanya dalam hari.
  // Cara yang lebih pendek — kurangi tahun, bulan, hari lalu pinjam sekali
  // kalau harinya minus — diam-diam salah di ujung bulan: dari 31 Januari ke 1
  // Maret, satu kali pinjam masih menyisakan angka minus karena Februari lebih
  // pendek dari jarak yang harus ditutup, dan harinya hilang dari hasil.
  let penuh = (kini.getUTCFullYear() - mulai.getUTCFullYear()) * 12 + (kini.getUTCMonth() - mulai.getUTCMonth());
  if (majuBulan(mulai, penuh).getTime() > kini.getTime()) penuh -= 1;

  const patokan = majuBulan(mulai, penuh);
  const hari = Math.round((kini.getTime() - patokan.getTime()) / 86_400_000);
  const tahun = Math.floor(penuh / 12);
  const bulan = penuh % 12;

  const bagian: string[] = [];
  if (tahun > 0) bagian.push(`${tahun} Tahun`);
  if (bulan > 0) bagian.push(`${bulan} Bulan`);
  if (hari > 0) bagian.push(`${hari} Hari`);
  return bagian.length ? bagian.join(" ") : "Karyawan baru";
}

/**
 * Maju `n` bulan dari sebuah tanggal, dipangkas ke hari terakhir bulan tujuan.
 *
 * Tanpa pemangkasan, 31 Januari + 1 bulan meluber jadi 3 Maret — Date memang
 * begitu — dan orang yang masuk di akhir bulan jadi terhitung lebih lama
 * bekerja daripada yang sebenarnya.
 */
function majuBulan(d: Date, n: number): Date {
  const tahun = d.getUTCFullYear();
  const bulan = d.getUTCMonth() + n;
  const akhir = new Date(Date.UTC(tahun, bulan + 1, 0)).getUTCDate();
  return new Date(Date.UTC(tahun, bulan, Math.min(d.getUTCDate(), akhir)));
}

/* ───────────────────────────── Benefit lainnya ───────────────────────────── */

export interface BarisProgram {
  program: string;
  peserta: number;
  target: number;
}

/** Sebuah program terpenuhi kalau seluruh sasarannya sudah terdaftar. */
export const programTerpenuhi = (p: BarisProgram): boolean => p.target > 0 && p.peserta >= p.target;
