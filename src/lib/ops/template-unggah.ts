import { EXPENSE_COLS, EXPENSE_LABELS, PNL_LABELS } from "./categories";
import { angkaExcel } from "./angka-excel";

/**
 * Satu pintu unggah data — SATU berkas, SATU baris judul, seluruh angka outlet.
 *
 * KENAPA SATU. Angka yang sama selama ini diketik di beberapa tempat yang tidak
 * saling tahu: laba bersih dan harga pokok di Operation → Laba Rugi DAN di KPI
 * Coordinator Area; pembelian warehouse di Operation → Pembelian DAN di KPI
 * PDQ. Dua salinan untuk satu kenyataan berarti keduanya bisa berbeda, dan
 * tidak ada cara tahu mana yang benar. Hasilnya terlihat di basis data: empat
 * dari lima tabel itu kosong karena orang memilih mengisi satu saja.
 *
 * Memecahnya jadi beberapa template hanya memindahkan masalahnya — tetap
 * beberapa kali unduh, beberapa kali unggah, untuk satu outlet yang sama.
 * Maka satu berkas: satu baris per outlet, seluruh kolom yang dibutuhkan
 * berjajar, lalu dituliskan ke SEMUA tempat yang memakainya dalam satu
 * tindakan — sehingga tidak mungkin lagi separuh terisi.
 *
 * TUJUANNYA DITULIS DI LAYAR, bukan disimpan di kepala orang. Yang mengunggah
 * berhak tahu angkanya akan muncul di mana sebelum ia menekan Simpan.
 */

/** Kolom angka, dikelompokkan — kelompoknya hanya untuk dibaca manusia di layar. */
export interface KelompokKolom {
  nama: string;
  kolom: readonly string[];
}

export const KOL_PEMBELIAN = ["Warehouse", "Non Warehouse"] as const;
export const KOL_BEBAN = EXPENSE_COLS.map((c) => EXPENSE_LABELS[c]);

export const KELOMPOK: readonly KelompokKolom[] = [
  { nama: "Pembelian", kolom: KOL_PEMBELIAN },
  { nama: "Harga Pokok", kolom: [PNL_LABELS.hpp] },
  { nama: "Beban Operasional", kolom: KOL_BEBAN },
  { nama: "Hasil", kolom: [PNL_LABELS.laba_bersih] },
];

export interface TemplateUnggah {
  nama: string;
  /** Nama sheet dan awalan nama berkasnya. */
  sheet: string;
  /** Kolom kunci — identitas barisnya. */
  kunci: string;
  /** Kolom teks yang ikut dibawa. */
  teks: readonly string[];
  /** Seluruh kolom angka, urut seperti di berkasnya. */
  angka: readonly string[];
  /** Ke mana datanya masuk, apa adanya. */
  tujuan: readonly string[];
}

/**
 * PENDAPATAN SENGAJA TIDAK DIMINTA.
 *
 * Gross sales ditarik otomatis dari ESB untuk outlet yang tersambung, dan
 * outlet yang diketik tangan punya jalurnya sendiri. Memintanya di sini berarti
 * angka ketikan menimpa angka mesin — kesalahan yang paling sulit ditemukan
 * belakangan, karena hasilnya tetap terlihat masuk akal.
 *
 * Begitu juga total beban: tidak diminta terpisah, melainkan dijumlahkan dari
 * delapan kolom rinciannya. Satu angka yang bisa diketik berbeda dari
 * rinciannya adalah satu angka yang cepat atau lambat akan berbeda.
 */
export const TEMPLATE: TemplateUnggah = {
  nama: "Data Bulanan Outlet",
  sheet: "Data Outlet",
  kunci: "Kode",
  teks: ["Outlet"],
  angka: KELOMPOK.flatMap((k) => k.kolom),
  tujuan: [
    "Operation → Pembelian",
    "Operation → Beban Operasional",
    "Operation → Laba Rugi",
    "Ops Dashboard",
    "KPI Coordinator Area — Net Profit (30%) & Harga Pokok Penjualan (20%)",
    "KPI PDQ Food & Beverage — Efisiensi Beban Operasional (berlaku sama untuk seluruh PIC)",
    "KPI Manajemen — komponen EBITDA",
  ],
};

/** Seluruh judul kolom, urut seperti di berkasnya. */
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

/** Baris yang seluruh kolom angkanya kosong — tidak dilaporkan bulan itu. */
export const barisKosong = (t: TemplateUnggah, b: BarisUnggah): boolean =>
  t.angka.every((k) => b.angka[k] === null);

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
