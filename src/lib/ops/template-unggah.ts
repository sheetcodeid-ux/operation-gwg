import { EXPENSE_COLS, EXPENSE_LABELS, PNL_COLS, PNL_LABELS } from "./categories";
import { angkaExcel } from "./angka-excel";

/**
 * Satu pintu unggah data — definisi templatenya, dipakai bersama layar dan server.
 *
 * KENAPA SATU PINTU. Angka yang sama selama ini diketik di dua tempat yang
 * tidak saling tahu: laba bersih dan harga pokok di Operation → Laba Rugi DAN
 * di KPI Coordinator Area; pembelian warehouse di Operation → Pembelian DAN di
 * KPI PDQ. Dua salinan untuk satu kenyataan berarti keduanya bisa berbeda, dan
 * tidak ada cara tahu mana yang benar. Hasilnya terlihat di basis data: empat
 * dari lima tabel itu kosong karena orang memilih mengisi satu saja.
 *
 * Sekarang satu berkas masuk sekali, lalu dituliskan ke SEMUA tempat yang
 * membutuhkannya dalam satu tindakan — sehingga tidak mungkin lagi separuh
 * terisi.
 *
 * TUJUANNYA DITULIS DI LAYAR, bukan disimpan di kepala orang. Yang mengunggah
 * berhak tahu angkanya akan muncul di mana sebelum ia menekan Simpan.
 */

export type JenisUnggah = "laba_rugi" | "pembelian" | "beban" | "bahan_baku";

export interface TemplateUnggah {
  jenis: JenisUnggah;
  nama: string;
  /** Nama sheet dan awalan nama berkasnya. */
  sheet: string;
  /**
   * Datanya milik satu BULAN tertentu.
   *
   * Bahan baku tidak: ia daftar harga yang berlaku sampai diganti. Bulan yang
   * dipilih tetap dicatat sebagai kapan daftar itu disetorkan, tapi tidak
   * membuat versi terpisah per bulan — dan layarnya mengatakan itu apa adanya
   * supaya tidak ada yang mengira harga Agustus tersimpan terpisah dari
   * September.
   */
  perBulan: boolean;
  /** Kolom kunci — identitas barisnya. */
  kunci: string;
  /** Kolom teks yang ikut dibawa. */
  teks: readonly string[];
  /** Kolom angka. */
  angka: readonly string[];
  /** Ke mana datanya masuk, apa adanya. */
  tujuan: readonly string[];
}

export const TEMPLATE: TemplateUnggah[] = [
  {
    jenis: "laba_rugi",
    nama: "Laba Rugi per Outlet",
    sheet: "Laba Rugi",
    perBulan: true,
    kunci: "Kode",
    teks: ["Outlet"],
    angka: PNL_COLS.map((c) => PNL_LABELS[c]),
    tujuan: [
      "Operation → Laba Rugi",
      "Ops Dashboard",
      "KPI Coordinator Area — Net Profit (30%) & Harga Pokok Penjualan (20%)",
      "KPI Manajemen — komponen EBITDA",
    ],
  },
  {
    jenis: "pembelian",
    nama: "Pembelian Warehouse & Non-Warehouse",
    sheet: "Pembelian",
    perBulan: true,
    kunci: "Kode",
    teks: ["Outlet"],
    angka: ["Warehouse", "Non Warehouse"],
    tujuan: [
      "Operation → Pembelian",
      "Ops Dashboard",
      "KPI PDQ Food & Beverage — Efisiensi Beban Operasional (berlaku sama untuk seluruh PIC)",
    ],
  },
  {
    jenis: "beban",
    nama: "Beban Operasional",
    sheet: "Beban",
    perBulan: true,
    kunci: "Kode",
    teks: ["Outlet"],
    angka: EXPENSE_COLS.map((c) => EXPENSE_LABELS[c]),
    tujuan: ["Operation → Beban Operasional", "Ops Dashboard"],
  },
  {
    jenis: "bahan_baku",
    nama: "Bahan Baku HPP",
    sheet: "Bahan Baku",
    perBulan: false,
    kunci: "Nama Bahan",
    teks: ["ID", "Satuan", "Satuan Pakai", "Golongan", "Wilayah"],
    angka: ["Harga Beli", "Qty", "Isi"],
    tujuan: [
      "R&D → Bahan Baku",
      "Seluruh perhitungan HPP resep",
      "Referensi Harga & peringatan kenaikan harga bahan",
    ],
  },
];

export const templateDari = (jenis: string): TemplateUnggah | undefined =>
  TEMPLATE.find((t) => t.jenis === jenis);

/** Seluruh judul kolom satu template, urut seperti di berkasnya. */
export const judulKolom = (t: TemplateUnggah): string[] => [t.kunci, ...t.teks, ...t.angka];

/** Satu baris hasil bacaan — teks apa adanya, angka sudah jadi angka. */
export interface BarisUnggah {
  kunci: string;
  teks: Record<string, string>;
  angka: Record<string, number | null>;
}

export interface HasilBacaUnggah {
  baris: BarisUnggah[];
  /** Baris yang kuncinya kosong — dilewati, tapi dihitung supaya bisa disebut. */
  tanpaKunci: number;
}

/**
 * Membaca baris mentah dari Excel menjadi bentuk yang bisa disimpan.
 *
 * Judul kolom dicocokkan TANPA membedakan besar-kecil huruf dan spasi
 * berlebih: berkas yang sudah beredar lewat WhatsApp sering pulang dengan
 * "kode" atau "Non  Warehouse", dan menolaknya hanya karena itu membuat orang
 * menyerah lalu mengetik manual — kembali ke masalah yang justru sedang
 * diperbaiki.
 */
export function bacaBarisUnggah(t: TemplateUnggah, rows: Record<string, unknown>[]): HasilBacaUnggah {
  const cocokkan = (r: Record<string, unknown>, judul: string): unknown => {
    const cari = judul.trim().toLowerCase().replace(/\s+/g, " ");
    for (const [k, v] of Object.entries(r)) {
      if (k.trim().toLowerCase().replace(/\s+/g, " ") === cari) return v;
    }
    return undefined;
  };

  const baris: BarisUnggah[] = [];
  let tanpaKunci = 0;
  for (const r of rows) {
    const kunci = String(cocokkan(r, t.kunci) ?? "").trim();
    if (!kunci) {
      tanpaKunci += 1;
      continue;
    }
    const teks: Record<string, string> = {};
    for (const k of t.teks) teks[k] = String(cocokkan(r, k) ?? "").trim();
    const angka: Record<string, number | null> = {};
    for (const k of t.angka) angka[k] = angkaExcel(cocokkan(r, k));
    baris.push({ kunci, teks, angka });
  }
  return { baris, tanpaKunci };
}
