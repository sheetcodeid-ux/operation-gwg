/**
 * Singkatan label untuk sumbu grafik.
 *
 * Nama departemen di GWG panjang-panjang ("Product Development & Quality",
 * "Finance Accounting Tax"). Ditulis utuh di sumbu X, labelnya saling menimpa
 * sampai tidak ada satu pun yang terbaca — persis seperti yang terlihat di
 * grafik sebelumnya.
 *
 * Aturannya tiga tingkat, dari yang paling bisa dipercaya ke yang paling umum:
 *
 *  1. Singkatan yang MEMANG dipakai orang di lapangan (Supervisor → SPV,
 *     Product Development & Quality → PDQ). Ini yang paling penting: singkatan
 *     buatan sendiri untuk istilah yang sudah punya singkatan resmi justru
 *     membuat pembacanya berhenti sejenak untuk menerjemahkan.
 *  2. Beberapa kata → huruf awal tiap kata ("Finance Accounting Tax" → FAT).
 *  3. Satu kata → tiga huruf pertama ("Operational" → OPE).
 *
 * Nama utuhnya tidak hilang: ia tetap muncul di tooltip saat batangnya
 * disentuh, jadi singkatan yang meleset pun tidak menyesatkan.
 */

/** Singkatan yang sudah dipakai sehari-hari di GWG. */
const KAMUS: Record<string, string> = {
  supervisor: "SPV",
  operational: "OPS",
  operation: "OPS",
  "human capital": "HC",
  "product development & quality": "PDQ",
  "product development and quality": "PDQ",
  "finance accounting tax": "FAT",
  "marketing communication": "MKT",
  "business development": "BD",
  "supply chain": "SCM",
  creative: "CRE",
  "project manager": "PM",
  auditor: "AUD",
  "executive assistant": "EA",
  administrator: "ADM",
  "tanpa departemen": "N/A",
  "tanpa brand": "N/A",
  "tidak dicatat": "N/A",
  manajemen: "MJM",
  outlet: "OTL",
  "lintas pilar": "UMUM",
};

/** Kata sambung yang tidak ikut jadi huruf awal. */
const ABAIKAN = new Set(["dan", "and", "&", "of", "the", "di", "per", "untuk"]);

export function singkat(nama: string): string {
  const bersih = (nama ?? "").trim();
  if (!bersih) return "—";

  const kunci = bersih.toLowerCase().replace(/\s+/g, " ");
  if (KAMUS[kunci]) return KAMUS[kunci];

  // Sudah pendek — tidak ada gunanya disingkat lagi.
  if (bersih.length <= 4) return bersih.toUpperCase();

  const kata = bersih
    .split(/[\s/·-]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w && !ABAIKAN.has(w.toLowerCase()));

  if (kata.length === 0) return bersih.slice(0, 3).toUpperCase();
  if (kata.length === 1) return kata[0].slice(0, 3).toUpperCase();

  // Huruf awal tiap kata, paling banyak empat — lebih dari itu tidak lagi
  // membantu dan mulai menimpa tetangganya.
  return kata
    .slice(0, 4)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Periode "2026-08" dan "Agustus 2026" disingkat jadi "AGU" — sumbu tren
 * tidak perlu mengulang tahunnya di setiap titik.
 */
const BULAN_SINGKAT = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
const NAMA_BULAN = [
  "januari", "februari", "maret", "april", "mei", "juni",
  "juli", "agustus", "september", "oktober", "november", "desember",
];

export function singkatPeriode(nama: string): string {
  const bersih = (nama ?? "").trim();
  const cocokAngka = bersih.match(/^(\d{4})-(\d{2})$/);
  if (cocokAngka) {
    const b = Number(cocokAngka[2]);
    if (b >= 1 && b <= 12) return BULAN_SINGKAT[b - 1];
    // Berbentuk periode tapi bulannya tidak masuk akal (mis. "2026-13").
    // Ditampilkan apa adanya — disingkat jadi "21" hanya menyembunyikan
    // datanya yang keliru alih-alih menunjukkannya.
    return bersih;
  }
  const kata = bersih.toLowerCase().split(/\s+/)[0];
  const idx = NAMA_BULAN.indexOf(kata);
  if (idx >= 0) return BULAN_SINGKAT[idx];
  return singkat(bersih);
}
