"use client";

import * as XLSX from "xlsx";

import { angkaExcel as angka } from "@/lib/ops/angka-excel";

/**
 * Lembar kerja Excel berbaris outlet — SATU pembaca untuk semua bentuknya.
 *
 * Diminta: nama outletnya sudah muncul sendiri, tinggal menambahkan angkanya.
 * Bentuknya berbeda antar-indikator — Coordinator Area mengisi Net Profit dan
 * Harga Pokok, PDQ mengisi realisasi beban warehouse dan non-warehouse —
 * tapi yang berbeda cuma judul kolomnya. Menyalin modul ini untuk tiap
 * indikator berarti menyalin juga pembaca angkanya, dan pembaca itulah bagian
 * yang paling mahal kalau salah: ia yang mengerti "1.234.567" ala Indonesia.
 * Dua salinan berarti suatu hari yang satu diperbaiki dan yang lain tidak.
 *
 * ID outletnya ikut dibawa di kolom pertama. Mencocokkan kembali lewat NAMA
 * akan gagal diam-diam begitu ada outlet yang berganti nama atau dua outlet
 * bernama mirip — dan yang gagal itu tidak akan mengeluh, ia hanya tidak
 * tersimpan.
 */

export interface SkemaLembar {
  /** Nama sheet di dalam berkasnya. */
  sheet: string;
  /** Dua kolom angka yang DIISI orang — hanya ini yang dibaca kembali. */
  isian: readonly [string, string];
  /**
   * Kolom keterangan yang hanya untuk dibaca, mis. budget yang dihitung
   * sistem. Ikut diunduh supaya yang mengisi punya pembanding di layar yang
   * sama, tapi TIDAK PERNAH dibaca kembali: angka yang dihitung sistem tidak
   * boleh bisa ditimpa dari berkas yang beredar lewat WhatsApp.
   */
  konteks?: readonly string[];
}

/** Kolom yang selalu ada, di depan. */
export const KOLOM_ID = "ID Outlet";
export const KOLOM_NAMA = "Nama Outlet";

/** Coordinator Area — Net Profit dan Harga Pokok sekaligus. */
export const LEMBAR_ANGKA_OUTLET: SkemaLembar = {
  sheet: "Angka Outlet",
  isian: ["Net Profit (Rp)", "Harga Pokok Penjualan (Rp)"],
};

/** PDQ — realisasi beban operasional, dengan budget sebagai pembanding. */
export const LEMBAR_EFISIENSI: SkemaLembar = {
  sheet: "Realisasi Beban",
  isian: ["Actual Warehouse (Rp)", "Actual Non-Warehouse (Rp)"],
  konteks: ["Average 3 Bulan (Rp)", "Budget (Rp)"],
};

export interface BarisLembar {
  outletId: string;
  outletNama: string;
  /** Dua angka isian, urut seperti `isian` pada skemanya. */
  nilai: [number | null, number | null];
  /** Angka keterangan, urut seperti `konteks` pada skemanya. */
  konteks?: (number | null)[];
}

const judul = (s: SkemaLembar): string[] => [KOLOM_ID, KOLOM_NAMA, ...(s.konteks ?? []), ...s.isian];

export function unduhLembar(skema: SkemaLembar, namaBerkas: string, baris: BarisLembar[]): void {
  const aoa: (string | number)[][] = [
    judul(skema),
    ...baris.map((b) => [
      b.outletId,
      b.outletNama,
      ...(skema.konteks ?? []).map((_, i) => b.konteks?.[i] ?? ""),
      ...b.nilai.map((n) => n ?? ""),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Lebar kolom disetel supaya nama outlet tidak terpotong saat dibuka — yang
  // terpotong akan dibaca sebagai outlet yang salah.
  ws["!cols"] = judul(skema).map((t, i) => ({ wch: i === 0 ? 40 : Math.max(18, t.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, skema.sheet);
  XLSX.writeFile(wb, `${namaBerkas}.xlsx`);
}

export interface HasilBaca {
  baris: BarisLembar[];
  /** Baris yang ID outletnya tidak dikenal — disebut, tidak didiamkan. */
  asing: string[];
}

/**
 * Membaca kembali lembar yang sudah diisi.
 *
 * Yang tidak dikenal TIDAK dibuang diam-diam. Berkas yang salah — lembar bulan
 * lain, atau hasil salin-tempel dari area orang lain — akan terbaca seperti
 * berhasil, dan yang mengisinya baru sadar berbulan-bulan kemudian bahwa
 * angkanya tidak pernah masuk.
 */
export async function bacaLembar(skema: SkemaLembar, file: File, dikenal: Set<string>): Promise<HasilBaca> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { baris: [], asing: [] };
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const baris: BarisLembar[] = [];
  const asing: string[] = [];
  for (const r of rows) {
    const id = String(r[KOLOM_ID] ?? "").trim();
    const nama = String(r[KOLOM_NAMA] ?? "").trim();
    if (!id) continue;
    if (!dikenal.has(id)) {
      asing.push(nama || id);
      continue;
    }
    // Kolom keterangan sengaja TIDAK dibaca: lihat penjelasan pada `konteks`.
    const nilai: [number | null, number | null] = [angka(r[skema.isian[0]]), angka(r[skema.isian[1]])];
    if (nilai[0] === null && nilai[1] === null) continue;
    baris.push({ outletId: id, outletNama: nama, nilai });
  }
  return { baris, asing };
}
