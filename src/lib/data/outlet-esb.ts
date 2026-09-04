import "server-only";

import { db, dbEnabled } from "./db";
import { esbConfigured, esbListBranches } from "@/lib/integrations/esb-client";

/**
 * Memasangkan outlet dengan id cabang ESB.
 *
 * KENAPA INI PERLU. `seasonal_daily.branch` menyimpan id cabang ESB
 * ("18-fnb_nord"), sedangkan `outlets` menyimpan nama panjang cabangnya. Tanpa
 * jembatan di antara keduanya, tabel Efisiensi Beban dan Invoice Management Fee
 * tampil kosong seluruhnya — tanpa satu pun pesan galat, karena memang tidak
 * ada yang gagal; yang dicocokkan saja tidak pernah bisa bertemu.
 *
 * Pemetaan nama → id hanya ada di ESB, tidak di basis data mana pun. Karena itu
 * pekerjaan ini memanggil daftar cabang ESB, bukan menebak dari data yang ada.
 *
 * HANYA COCOK PERSIS YANG DIPASANG. Nama yang mirip tidak dipasangkan sendiri:
 * "Nordu Banjarbaru 2" dan "Nordu Banjarbaru 2 -" adalah dua cabang berbeda di
 * ESB, dan salah pasang berarti penjualan cabang lain masuk ke KPI outlet ini —
 * angkanya tetap terlihat wajar, dan tidak akan pernah ada yang memeriksanya
 * lagi. Yang tidak cocok dilaporkan namanya supaya bisa dipasang manual.
 */

export interface HasilPasang {
  dipasang: { outlet: string; branchId: string }[];
  /** Sudah punya id sebelum ini — tidak disentuh. */
  sudah: number;
  /** Outlet yang namanya tidak ada di daftar cabang ESB. */
  tanpaPadanan: string[];
  /** Cabang ESB yang tidak dipakai outlet mana pun — beserta idnya, karena
   *  sisanya memang harus dipasang dengan tangan dan idnya yang dibutuhkan. */
  cabangTakTerpakai: { id: string; nama: string }[];
  error?: string;
}

/**
 * Menyeragamkan nama sebelum dicocokkan.
 *
 * Yang dibereskan hanya perbedaan yang TIDAK mengubah identitas cabang: besar
 * kecil huruf, spasi ganda, dan tanda baca di ujung ("Nordu Banjarbaru -").
 * Angka dan kata tidak disentuh sama sekali — "Yogyakarta 1" dan "Yogyakarta 2"
 * harus tetap berbeda.
 */
export function samakan(nama: string): string {
  return nama
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .trim();
}

interface BarisOutlet {
  id: string;
  name: string;
  esb_branch_id: string | null;
}

export async function pasangkanOutletEsb(): Promise<HasilPasang> {
  const kosong: HasilPasang = { dipasang: [], sudah: 0, tanpaPadanan: [], cabangTakTerpakai: [] };
  if (!dbEnabled) return { ...kosong, error: "Basis data tidak aktif." };
  if (!esbConfigured()) return { ...kosong, error: "Integrasi ESB belum dikonfigurasi." };

  const cabang = await esbListBranches();
  if (cabang.length === 0) return { ...kosong, error: "Daftar cabang ESB kosong." };

  // Nama yang muncul dua kali di ESB tidak dipakai sama sekali: tidak ada cara
  // memilih di antaranya, dan memilih yang pertama berarti memilih secara acak.
  const jumlahNama = new Map<string, number>();
  for (const b of cabang) jumlahNama.set(samakan(b.name), (jumlahNama.get(samakan(b.name)) ?? 0) + 1);
  const petaCabang = new Map<string, string>();
  for (const b of cabang) if (jumlahNama.get(samakan(b.name)) === 1) petaCabang.set(samakan(b.name), b.id);

  const { data, error } = await db().from("outlets").select("id,name,esb_branch_id");
  if (error) return { ...kosong, error: error.message };
  const outlets = (data ?? []) as BarisOutlet[];

  const hasil: HasilPasang = { dipasang: [], sudah: 0, tanpaPadanan: [], cabangTakTerpakai: [] };
  const terpakai = new Set<string>();

  for (const o of outlets) {
    if (o.esb_branch_id) {
      hasil.sudah += 1;
      terpakai.add(o.esb_branch_id);
      continue;
    }
    const id = petaCabang.get(samakan(o.name));
    if (!id) {
      hasil.tanpaPadanan.push(o.name);
      continue;
    }
    const up = await db().from("outlets").update({ esb_branch_id: id }).eq("id", o.id);
    if (up.error) return { ...hasil, error: up.error.message };
    hasil.dipasang.push({ outlet: o.name, branchId: id });
    terpakai.add(id);
  }

  hasil.cabangTakTerpakai = cabang
    .filter((b) => !terpakai.has(b.id))
    .map((b) => ({ id: b.id, nama: b.name }))
    .sort((a, b) => a.nama.localeCompare(b.nama, "id"));
  return hasil;
}
