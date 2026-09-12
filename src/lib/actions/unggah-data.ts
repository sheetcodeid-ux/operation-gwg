"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { getOutlets } from "@/lib/data/store";
import { upsertExpenses, upsertPurchases } from "@/lib/data/ops-finance";
import { upsertPnl } from "@/lib/data/ops-pnl";
import { simpanOutletBulanan } from "@/lib/data/kpi";
import { upsertIngredient } from "@/lib/data/hpp-ingredients";
import { parseGolongan } from "@/lib/hpp/golongan";
import { EXPENSE_COLS, EXPENSE_LABELS, PNL_LABELS, type ExpenseRow, type PnlRow, type PurchaseRow } from "@/lib/ops/categories";
import { templateDari, type BarisUnggah, type JenisUnggah } from "@/lib/ops/template-unggah";

/**
 * Satu pintu unggah — penulisnya.
 *
 * SATU BERKAS MASUK SEKALI, LALU DITULIS KE SEMUA TEMPAT YANG MEMBUTUHKANNYA.
 * Sebelumnya laba bersih dan harga pokok harus diketik di Operation DAN di KPI
 * Coordinator Area, pembelian warehouse di Operation DAN di KPI PDQ. Dua
 * salinan untuk satu kenyataan berarti keduanya bisa berbeda dan tidak ada cara
 * tahu mana yang benar — dan akibatnya terlihat di basis data: orang memilih
 * mengisi satu saja, sisanya ditinggal kosong.
 */

export interface HasilUnggah {
  ok?: true;
  /** Berapa baris benar-benar tersimpan. */
  tersimpan?: number;
  /** Ke mana saja angkanya masuk — dilaporkan balik, bukan diasumsikan. */
  tujuan?: string[];
  /** Baris yang kuncinya tidak dikenali — disebut, tidak didiamkan. */
  asing?: string[];
  error?: string;
}

const MENU = "unggah_data" as MenuKey;

/** Outlet aktif berkunci KODE — kode itulah yang dipakai di dalam berkas. */
function outletDariKode() {
  return new Map(
    getOutlets()
      .filter((o) => o.active && o.code?.trim())
      .map((o) => [o.code.trim().toLowerCase(), o]),
  );
}

export async function simpanUnggahAction(input: {
  jenis: JenisUnggah;
  periode: string;
  baris: BarisUnggah[];
}): Promise<HasilUnggah> {
  const user = await getSessionUser();
  if (!user || !canReachMenu(user, MENU)) return { error: "Tidak punya akses." };

  const t = templateDari(input.jenis);
  if (!t) return { error: "Jenis data tidak dikenali." };
  if (t.perBulan && !/^\d{4}-\d{2}$/.test(input.periode)) return { error: "Bulannya tidak dikenali." };
  if (input.baris.length === 0) return { error: "Tidak ada baris yang terbaca dari berkas itu." };

  try {
    switch (input.jenis) {
      case "laba_rugi":
        return await simpanLabaRugi(input.periode, input.baris, user.id, user.name);
      case "pembelian":
        return await simpanPembelian(input.periode, input.baris);
      case "beban":
        return await simpanBeban(input.periode, input.baris);
      case "bahan_baku":
        return await simpanBahanBaku(input.baris, user.id);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}

/**
 * Laba Rugi — masuk ke Operation DAN ke KPI Coordinator Area.
 *
 * GROSS SALES SENGAJA TIDAK DISENTUH. Untuk outlet yang tersambung ESB,
 * penjualannya ditarik otomatis; outlet yang diketik tangan punya jalurnya
 * sendiri. Menuliskan "Pendapatan" dari berkas ke sana akan menimpa angka ESB
 * dengan angka ketikan — dan angka ketikan yang menimpa angka mesin adalah
 * persis kesalahan yang paling sulit ditemukan belakangan.
 */
async function simpanLabaRugi(periode: string, baris: BarisUnggah[], olehId: string, olehNama: string): Promise<HasilUnggah> {
  const peta = outletDariKode();
  const asing: string[] = [];
  const pnl: PnlRow[] = [];
  const keKpi: { outletId: string; netProfit: number | null; hppNominal: number | null }[] = [];

  for (const b of baris) {
    const o = peta.get(b.kunci.trim().toLowerCase());
    if (!o) {
      asing.push(b.teks["Outlet"] || b.kunci);
      continue;
    }
    pnl.push({
      outletCode: o.code,
      outletName: o.name,
      pendapatan: b.angka[PNL_LABELS.pendapatan] ?? 0,
      hpp: b.angka[PNL_LABELS.hpp] ?? 0,
      beban: b.angka[PNL_LABELS.beban] ?? 0,
      laba_bersih: b.angka[PNL_LABELS.laba_bersih] ?? 0,
    });
    keKpi.push({
      outletId: o.id,
      netProfit: b.angka[PNL_LABELS.laba_bersih],
      hppNominal: b.angka[PNL_LABELS.hpp],
    });
  }
  if (pnl.length === 0) return { error: "Tidak ada kode outlet yang dikenali. Pakai template yang diunduh dari sini.", asing };

  await upsertPnl(periode, pnl);
  for (const k of keKpi) {
    // Kolom yang KOSONG di berkas tidak menimpa angka yang sudah ada: kosong
    // berarti "tidak dilaporkan bulan ini", bukan "nol rupiah".
    if (k.netProfit === null && k.hppNominal === null) continue;
    const res = await simpanOutletBulanan({
      outletId: k.outletId,
      periode,
      ...(k.netProfit === null ? {} : { netProfit: k.netProfit }),
      ...(k.hppNominal === null ? {} : { hppNominal: k.hppNominal }),
      olehId,
      olehNama,
    });
    if (res.error) throw new Error(res.error);
  }

  revalidatePath("/operation/laba-rugi");
  revalidatePath("/kpi/operational_ca");
  return {
    ok: true,
    tersimpan: pnl.length,
    asing,
    tujuan: ["Operation → Laba Rugi", "KPI Coordinator Area (Net Profit & Harga Pokok)", "KPI Manajemen — EBITDA"],
  };
}

/**
 * Pembelian — masuk ke Operation DAN dipakai KPI PDQ.
 *
 * Satu baris per outlet, bukan satu baris per PIC: pembelian warehouse satu
 * outlet sama bagi siapa pun di PDQ yang dinilai atasnya.
 */
async function simpanPembelian(periode: string, baris: BarisUnggah[]): Promise<HasilUnggah> {
  const peta = outletDariKode();
  const asing: string[] = [];
  const rows: PurchaseRow[] = [];
  for (const b of baris) {
    const o = peta.get(b.kunci.trim().toLowerCase());
    if (!o) {
      asing.push(b.teks["Outlet"] || b.kunci);
      continue;
    }
    rows.push({
      outletCode: o.code,
      outletName: o.name,
      warehouse: b.angka["Warehouse"] ?? 0,
      nonWarehouse: b.angka["Non Warehouse"] ?? 0,
    });
  }
  if (rows.length === 0) return { error: "Tidak ada kode outlet yang dikenali. Pakai template yang diunduh dari sini.", asing };

  await upsertPurchases(periode, rows);
  revalidatePath("/operation/pembelian");
  revalidatePath("/kpi/pdq_food");
  revalidatePath("/kpi/pdq_beverage");
  return {
    ok: true,
    tersimpan: rows.length,
    asing,
    tujuan: ["Operation → Pembelian", "KPI PDQ Food & Beverage — Efisiensi Beban (berlaku sama untuk seluruh PIC)"],
  };
}

async function simpanBeban(periode: string, baris: BarisUnggah[]): Promise<HasilUnggah> {
  const peta = outletDariKode();
  const asing: string[] = [];
  const rows: ExpenseRow[] = [];
  for (const b of baris) {
    const o = peta.get(b.kunci.trim().toLowerCase());
    if (!o) {
      asing.push(b.teks["Outlet"] || b.kunci);
      continue;
    }
    const row = { outletCode: o.code, outletName: o.name } as ExpenseRow;
    for (const c of EXPENSE_COLS) row[c] = b.angka[EXPENSE_LABELS[c]] ?? 0;
    rows.push(row);
  }
  if (rows.length === 0) return { error: "Tidak ada kode outlet yang dikenali. Pakai template yang diunduh dari sini.", asing };

  await upsertExpenses(periode, rows);
  revalidatePath("/operation/beban");
  return { ok: true, tersimpan: rows.length, asing, tujuan: ["Operation → Beban Operasional", "Ops Dashboard"] };
}

/**
 * Bahan Baku — daftar harga yang BERLAKU SAMPAI DIGANTI, bukan milik satu bulan.
 *
 * Bulan yang dipilih di layar tidak ikut tersimpan di sini, dan layarnya
 * mengatakan itu apa adanya: kalau dibiarkan tampak seperti data bulanan, orang
 * akan mengira harga Agustus masih tersimpan terpisah setelah September
 * diunggah — lalu mencarinya, dan tidak menemukannya.
 */
async function simpanBahanBaku(baris: BarisUnggah[], olehId: string): Promise<HasilUnggah> {
  const rows = baris
    .map((b) => ({
      id: b.teks["ID"] || undefined,
      name: b.kunci,
      buyPrice: b.angka["Harga Beli"] ?? 0,
      buyQty: b.angka["Qty"] || 1,
      buyUnit: b.teks["Satuan"] || "kg",
      contentQty: b.angka["Isi"] || 1,
      contentUnit: b.teks["Satuan Pakai"] || b.teks["Satuan"] || "kg",
      golongan: parseGolongan(b.teks["Golongan"]),
      region: b.teks["Wilayah"] || null,
    }))
    .filter((r) => r.name.trim() !== "");
  if (rows.length === 0) return { error: "Tidak ada baris bahan yang terbaca." };

  // Satu per satu, bukan sekali borong: `upsertIngredient` juga yang menandai
  // kenaikan harga di atas 5% dan menyimpan harga sebelumnya. Menulis langsung
  // ke tabel demi cepat akan melewati peringatan itu — dan peringatan kenaikan
  // harga bahan justru salah satu alasan modul ini dibuat.
  let n = 0;
  for (const r of rows) {
    await upsertIngredient(r, olehId);
    n += 1;
  }
  revalidatePath("/rnd/hpp/bahan");
  return {
    ok: true,
    tersimpan: n,
    tujuan: ["R&D → Bahan Baku", "Seluruh perhitungan HPP resep", "Referensi Harga & peringatan kenaikan harga"],
  };
}
