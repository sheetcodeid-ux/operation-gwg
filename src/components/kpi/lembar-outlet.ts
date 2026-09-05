"use client";

import * as XLSX from "xlsx";

/**
 * Lembar kerja angka bulanan per outlet — SATU format untuk dua indikator.
 *
 * Diminta: nama outletnya sudah muncul sendiri, tinggal menambahkan angkanya.
 * Membuat dua format terpisah untuk Net Profit dan Harga Pokok Penjualan
 * berarti dua kali unduh, dua kali unggah, dan dua kesempatan tertukar berkas —
 * padahal keduanya diisi orang yang sama untuk outlet yang sama pada bulan yang
 * sama.
 *
 * ID outletnya ikut dibawa di kolom pertama. Mencocokkan kembali lewat NAMA
 * akan gagal diam-diam begitu ada outlet yang berganti nama atau dua outlet
 * bernama mirip — dan yang gagal itu tidak akan mengeluh, ia hanya tidak
 * tersimpan.
 */

export const KOLOM_LEMBAR = ["ID Outlet", "Nama Outlet", "Net Profit (Rp)", "Harga Pokok Penjualan (Rp)"] as const;

export interface BarisLembar {
  outletId: string;
  outletNama: string;
  netProfit: number | null;
  hppNominal: number | null;
}

export function unduhLembar(namaBerkas: string, baris: BarisLembar[]): void {
  const aoa: (string | number)[][] = [
    [...KOLOM_LEMBAR],
    ...baris.map((b) => [b.outletId, b.outletNama, b.netProfit ?? "", b.hppNominal ?? ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Lebar kolom disetel supaya nama outlet tidak terpotong saat dibuka — yang
  // terpotong akan dibaca sebagai outlet yang salah.
  ws["!cols"] = [{ wch: 40 }, { wch: 34 }, { wch: 22 }, { wch: 28 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Angka Outlet");
  XLSX.writeFile(wb, `${namaBerkas}.xlsx`);
}

export interface HasilBaca {
  baris: BarisLembar[];
  /** Baris yang ID outletnya tidak dikenal — disebut, tidak didiamkan. */
  asing: string[];
}

const angka = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * Membaca kembali lembar yang sudah diisi.
 *
 * Yang tidak dikenal TIDAK dibuang diam-diam. Berkas yang salah — lembar bulan
 * lain, atau hasil salin-tempel dari area orang lain — akan terbaca seperti
 * berhasil, dan yang mengisinya baru sadar berbulan-bulan kemudian bahwa
 * angkanya tidak pernah masuk.
 */
export async function bacaLembar(file: File, dikenal: Set<string>): Promise<HasilBaca> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { baris: [], asing: [] };
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  const baris: BarisLembar[] = [];
  const asing: string[] = [];
  for (const r of rows) {
    const id = String(r[KOLOM_LEMBAR[0]] ?? "").trim();
    const nama = String(r[KOLOM_LEMBAR[1]] ?? "").trim();
    if (!id) continue;
    if (!dikenal.has(id)) {
      asing.push(nama || id);
      continue;
    }
    const netProfit = angka(r[KOLOM_LEMBAR[2]]);
    const hppNominal = angka(r[KOLOM_LEMBAR[3]]);
    if (netProfit === null && hppNominal === null) continue;
    baris.push({ outletId: id, outletNama: nama, netProfit, hppNominal });
  }
  return { baris, asing };
}
