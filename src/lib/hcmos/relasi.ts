/**
 * Hitungan untuk Case Management dan Offboarding / Exit Process.
 *
 * Keduanya membaca tabel yang sama (`hc_cases`, dibedakan kolom `jenis`) tapi
 * menjawab pertanyaan yang berbeda: yang satu soal perkara yang harus
 * diselesaikan, yang lain soal orang yang sedang keluar. Aturan hitungnya
 * ditulis di sini, terpisah dari tampilan, supaya bisa diuji tanpa menyiapkan
 * apa pun.
 */

export const ESKALASI = {
  rendah: { label: "Rendah", tone: "neutral" as const },
  normal: { label: "Normal", tone: "warning" as const },
  tinggi: { label: "Tinggi", tone: "danger" as const },
};
export type Eskalasi = keyof typeof ESKALASI;

export const eskalasiValid = (v: string): v is Eskalasi =>
  Object.prototype.hasOwnProperty.call(ESKALASI, v);

export interface PerkaraRingkas {
  nama: string;
  scope: string;
  kategori: string;
  status: string;
  eskalasi: string;
  tanggal: string | null;
  tglSelesai: string | null;
  exitInterview: boolean;
  serahAset: boolean;
  payrollFinal: boolean;
}

/** Selisih hari antara dua tanggal ISO; null bila salah satunya tidak ada. */
export function lamaHari(mulai: string | null, selesai: string | null): number | null {
  if (!mulai || !selesai) return null;
  const a = Date.parse(mulai);
  const b = Date.parse(selesai);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.round((b - a) / 86_400_000);
}

/**
 * Rata-rata waktu penyelesaian, dalam hari.
 *
 * Hanya perkara yang punya KEDUA tanggalnya yang ikut dihitung. Perkara yang
 * masih berjalan sengaja tidak dianggap "nol hari" — kalau ikut, semakin
 * menumpuk perkara yang belum selesai, semakin cepat rata-ratanya terlihat.
 */
export function rataWaktuSelesai(rows: PerkaraRingkas[]): number | null {
  const lama = rows.map((r) => lamaHari(r.tanggal, r.tglSelesai)).filter((n): n is number => n !== null);
  if (lama.length === 0) return null;
  return Math.round((lama.reduce((a, b) => a + b, 0) / lama.length) * 10) / 10;
}

export interface RingkasKasus {
  berjalan: number;
  selesaiTahunIni: number;
  eskalasiTinggi: number;
  rataHari: number | null;
  total: number;
}

/** Ringkasan Case Management untuk satu scope. */
export function ringkasKasus(rows: PerkaraRingkas[], tahun: number): RingkasKasus {
  const selesai = rows.filter((r) => r.status === "selesai");
  return {
    berjalan: rows.filter((r) => r.status !== "selesai").length,
    // Tahunnya diambil dari tanggal SELESAI, bukan tanggal masuk: yang
    // ditanyakan "berapa yang kita tuntaskan tahun ini", dan perkara lama yang
    // baru ditutup bulan lalu memang termasuk.
    selesaiTahunIni: selesai.filter((r) => (r.tglSelesai ?? "").startsWith(String(tahun))).length,
    eskalasiTinggi: rows.filter((r) => r.eskalasi === "tinggi" && r.status !== "selesai").length,
    rataHari: rataWaktuSelesai(rows),
    total: rows.length,
  };
}

export interface RingkasKeluar {
  keluarTahunIni: number;
  exitInterview: number;
  serahAset: number;
  payrollFinal: number;
  total: number;
}

/**
 * Ringkasan Offboarding untuk satu scope.
 *
 * Ketiga langkahnya dihitung terhadap karyawan yang keluar TAHUN INI, bukan
 * terhadap seluruh riwayat. Penyebut yang memuat semua tahun membuat pencapaian
 * tahun berjalan tenggelam di antara arsip lama, dan "3/3" berubah jadi "3/47"
 * tanpa ada yang berubah di dunia nyata.
 */
export function ringkasKeluar(rows: PerkaraRingkas[], tahun: number): RingkasKeluar {
  const tahunIni = rows.filter((r) => (r.tanggal ?? "").startsWith(String(tahun)));
  return {
    keluarTahunIni: tahunIni.length,
    exitInterview: tahunIni.filter((r) => r.exitInterview).length,
    serahAset: tahunIni.filter((r) => r.serahAset).length,
    payrollFinal: tahunIni.filter((r) => r.payrollFinal).length,
    total: rows.length,
  };
}

/** Sebaran alasan keluar — terbanyak lebih dulu. */
export function alasanKeluar(rows: PerkaraRingkas[]): { nama: string; nilai: number }[] {
  const per = new Map<string, number>();
  for (const r of rows) {
    const k = r.kategori.trim() || "Tidak dicatat";
    per.set(k, (per.get(k) ?? 0) + 1);
  }
  return [...per.entries()]
    .map(([nama, nilai]) => ({ nama, nilai }))
    .sort((a, b) => b.nilai - a.nilai || a.nama.localeCompare(b.nama, "id"));
}

/**
 * Tahapan baku proses keluar karyawan.
 *
 * Ditulis tanpa penanda "sedang berjalan", sama seperti alur SOP lainnya: pada
 * saat yang sama bisa ada beberapa orang yang keluar, masing-masing di langkah
 * berbeda. Menandai satu langkah berarti memilih salah satunya secara
 * sewenang-wenang.
 */
export const TAHAP_OFFBOARDING = [
  { judul: "Notifikasi Resign / PHK", isi: "Diterima Kepala Divisi atau Outlet Manager, lalu diteruskan ke Human Capital." },
  { judul: "Exit Interview", isi: "Human Capital menggali umpan balik dan alasan keluar yang sebenarnya." },
  { judul: "Serah Terima Aset & Akses", isi: "Aset perusahaan dikembalikan dan seluruh akses sistem dinonaktifkan." },
  { judul: "Payroll Final & Pesangon", isi: "Finance memproses gaji terakhir sesuai ketentuan yang berlaku." },
  { judul: "Update Database Karyawan", isi: "Status diubah menjadi non-aktif di Database Karyawan." },
];
