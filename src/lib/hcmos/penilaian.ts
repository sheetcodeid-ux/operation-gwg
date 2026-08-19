/**
 * Status penilaian kinerja per unit.
 *
 * Pertanyaan yang dijawab berkas ini cuma satu, dan itu pertanyaan pertama yang
 * ditanyakan siapa pun saat periode penilaian berjalan: dari sekian karyawan,
 * berapa yang sudah dinilai.
 *
 * PEMBAGINYA yang perlu hati-hati. Jumlah karyawan tidak diambil dari tabel
 * penilaian — kalau begitu, setiap orang yang belum dinilai juga hilang dari
 * penyebut, dan angkanya selalu terbaca 100%. Manajemen dihitung dari User
 * Management, outlet dari Kontrak Tracker; keduanya sumber yang tahu siapa
 * SEHARUSNYA dinilai, bukan siapa yang sudah.
 */

export type ScopePenilaian = "manajemen" | "outlet";

/** Status di `hc_reviews` yang berarti penilaiannya sudah masuk. */
export const STATUS_SUDAH_DINILAI = ["selesai", "ditinjau"] as const;

export interface ReviewRingkas {
  nama: string;
  scope: string;
  periode: string;
  status: string;
}

export const sudahDinilai = (status: string): boolean =>
  (STATUS_SUDAH_DINILAI as readonly string[]).includes(status.trim().toLowerCase());

export interface BarisUnit {
  unit: string;
  scope: ScopePenilaian;
  totalKaryawan: number;
  selesai: number;
  belum: number;
  persen: number | null;
  /** Periode yang paling banyak dipakai di unit ini; kosong bila belum ada. */
  periode: string;
}

/**
 * Rekap satu unit.
 *
 * Orang dihitung sekali walau punya beberapa baris penilaian — satu karyawan
 * bisa dinilai beberapa periode, dan menghitung barisnya membuat unit berisi
 * sepuluh orang terbaca sudah menilai tiga puluh.
 */
export function rekapUnit(
  unit: string,
  scope: ScopePenilaian,
  totalKaryawan: number,
  reviews: ReviewRingkas[],
): BarisUnit {
  const milikUnit = reviews.filter((r) => r.scope.trim().toLowerCase() === scope);
  const orangSelesai = new Set(
    milikUnit.filter((r) => sudahDinilai(r.status)).map((r) => r.nama.trim().toLowerCase()).filter(Boolean),
  );
  // Penilaian bisa saja tercatat untuk orang yang sudah tidak aktif lagi;
  // jumlah selesai tidak boleh melampaui jumlah karyawannya, karena persen di
  // atas 100 membuat pembacanya berhenti mempercayai seluruh tabelnya.
  const selesai = Math.min(orangSelesai.size, totalKaryawan);
  return {
    unit,
    scope,
    totalKaryawan,
    selesai,
    belum: Math.max(0, totalKaryawan - selesai),
    persen: totalKaryawan === 0 ? null : Math.round((selesai / totalKaryawan) * 100),
    periode: periodeTerbanyak(milikUnit),
  };
}

/**
 * Periode yang paling sering muncul.
 *
 * Dipakai karena `periode` di `hc_reviews` adalah isian bebas: ada yang menulis
 * "Juli–Agustus 2026", ada yang "2026-08". Mengambil yang terbanyak lebih jujur
 * daripada menebak formatnya, dan bila ternyata isinya berantakan hal itu
 * justru kelihatan alih-alih tersembunyi di balik tanggal yang dikarang.
 */
export function periodeTerbanyak(reviews: ReviewRingkas[]): string {
  const hitung = new Map<string, number>();
  for (const r of reviews) {
    const p = r.periode.trim();
    if (p) hitung.set(p, (hitung.get(p) ?? 0) + 1);
  }
  let juara = "";
  let tertinggi = 0;
  for (const [p, n] of hitung) if (n > tertinggi) [juara, tertinggi] = [p, n];
  return juara;
}

/* ───────────────────────────── Appraisal Review ───────────────────────────── */

export const STATUS_SESI = {
  terjadwal: { label: "Terjadwal", tone: "warning" as const },
  selesai: { label: "Selesai", tone: "success" as const },
  batal: { label: "Batal", tone: "danger" as const },
};
export type StatusSesi = keyof typeof STATUS_SESI;

export const statusSesiValid = (v: string): v is StatusSesi =>
  Object.prototype.hasOwnProperty.call(STATUS_SESI, v);
