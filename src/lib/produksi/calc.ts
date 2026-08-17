import { itemSubtotal, UNITS, type VariableItem } from "@/lib/hpp/calc";

/**
 * HPP Produksi — perhitungan biaya untuk gudang (Supply Chain).
 *
 * Bentuknya mirip Kalkulator HPP milik PDQ, tapi PERTANYAANNYA berbeda, dan itu
 * yang menentukan rumusnya:
 *
 *   PDQ menanyakan  : "berapa menu ini harus dijual?"
 *   Gudang menanyakan: "berapa biaya satu potong yang saya kirim ke outlet?"
 *
 * Gudang tidak menjual ke pelanggan, jadi tidak ada harga jual, tidak ada
 * margin, dan TIDAK ADA TARGET OMSET. Ketiadaan target omset bukan sekadar
 * kolom yang dihapus — ia mengubah cara overhead dibagi:
 *
 *   PDQ    : overhead BULANAN ÷ target penjualan sebulan
 *   Gudang : overhead SEKALI MASAK ÷ hasil sekali masak itu
 *
 * Gas, listrik, dan tenaga kerja untuk satu kali mengungkep ayam melekat pada
 * masakan itu sendiri — bukan pada bulan berjalan. Memaksakan pembagian bulanan
 * akan menuntut angka yang memang tidak dimiliki gudang, dan hasilnya berubah
 * setiap kali ada tambahan produksi yang tidak ada hubungannya.
 *
 * Konversi satuan sengaja MEMAKAI ULANG `itemSubtotal` milik PDQ. Menyalinnya
 * berarti dua rumus yang harus dijaga tetap sama, dan yang satu pasti tertinggal
 * saat yang lain diperbaiki.
 */

const bulat2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Cara produk dihitung.
 *  • `batch`  — sekali masak menghasilkan banyak (ayam ungkep → 40 potong).
 *  • `satuan` — dihitung langsung untuk satu unit (roti isi → 1 pcs).
 *
 * Keduanya memakai rumus yang sama; `satuan` hanyalah batch dengan hasil 1.
 * Dipisahkan supaya formulirnya bisa menyembunyikan kolom hasil yang tidak
 * berarti, bukan karena hitungannya berbeda.
 */
export type ProduksiMode = "batch" | "satuan";

/** Satuan hasil produksi — yang benar-benar dipakai gudang saat menyerahkan. */
export const SATUAN_HASIL = ["pcs", "porsi", "pack", "kg", "g", "L", "ml"] as const;

/** Satu baris biaya per SEKALI MASAK, bukan per bulan. */
export interface OverheadProduksi {
  id: string;
  name: string;
  /** Rupiah untuk satu kali produksi ini. */
  biaya: number;
}

export interface ProduksiInput {
  bahan: VariableItem[];
  overhead: OverheadProduksi[];
  /** Hasil satu kali masak, dalam `hasilUnit`. */
  hasil: number;
  hasilUnit: string;
  /**
   * Penyusutan saat diproses, dalam persen.
   *
   * Ayam mentah 10 kg tidak menghasilkan 10 kg ayam ungkep — air menguap dan
   * ada bagian yang terbuang. Tanpa memperhitungkannya, HPP per potong selalu
   * terlihat lebih murah daripada kenyataannya, dan selisihnya baru ketahuan
   * saat stok tidak pernah cukup.
   */
  susutPct: number;
}

export interface ProduksiHasil {
  /** Total bahan untuk satu kali masak. */
  biayaBahan: number;
  /** Total overhead untuk satu kali masak. */
  biayaOverhead: number;
  /** Bahan + overhead — biaya satu kali masak. */
  totalBatch: number;
  /** Hasil setelah dikurangi penyusutan. */
  hasilBersih: number;
  /** Biaya satu unit hasil. Inilah angka yang dipakai gudang. */
  hppPerUnit: number;
  /** Berapa persen biaya berasal dari bahan — sisanya overhead. */
  porsiBahanPct: number;
}

export function hitungProduksi(input: ProduksiInput): ProduksiHasil {
  const biayaBahan = bulat2(input.bahan.reduce((s, b) => s + itemSubtotal(b), 0));
  const biayaOverhead = bulat2(input.overhead.reduce((s, o) => s + (Number(o.biaya) || 0), 0));
  const totalBatch = bulat2(biayaBahan + biayaOverhead);

  const susut = Math.min(100, Math.max(0, Number(input.susutPct) || 0));
  const hasilKotor = Math.max(0, Number(input.hasil) || 0);
  const hasilBersih = bulat2(hasilKotor * (1 - susut / 100));

  // Hasil nol berarti BELUM DIISI, bukan "biayanya tak terhingga". Mengembalikan
  // 0 membuat layarnya menampilkan angka kosong yang jujur; membiarkan pembagian
  // nol akan memunculkan "Infinity" atau "NaN" di kartu hasil.
  const hppPerUnit = hasilBersih > 0 ? bulat2(totalBatch / hasilBersih) : 0;
  const porsiBahanPct = totalBatch > 0 ? bulat2((biayaBahan / totalBatch) * 100) : 0;

  return { biayaBahan, biayaOverhead, totalBatch, hasilBersih, hppPerUnit, porsiBahanPct };
}

/**
 * Apakah satuan hasil sejenis dengan satuan bahan terbesar?
 *
 * Dipakai hanya sebagai PERINGATAN, tidak pernah menolak simpan. Menghasilkan
 * "40 pcs" dari bahan berbasis kilogram itu wajar (ayam → potong), jadi
 * ketidakcocokan bukan kesalahan — tapi mengisi hasil dalam gram padahal
 * maksudnya potong adalah salah ketik yang mahal, dan itu layak ditanyakan.
 */
export function satuanSejenis(hasilUnit: string, bahanUnit: string): boolean {
  const a = UNITS[hasilUnit];
  const b = UNITS[bahanUnit];
  if (!a || !b) return true; // satuan di luar daftar (porsi, pack) — tidak dinilai
  return a.dim === b.dim;
}
