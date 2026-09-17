"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu, type MenuKey } from "@/lib/nav";
import { getOutlets } from "@/lib/data/store";
import { listExpenses, upsertExpenses, upsertPurchases } from "@/lib/data/ops-finance";
import { listPnl, upsertPnl } from "@/lib/data/ops-pnl";
import { batchSama, catatBatch, tandaiGagal } from "@/lib/data/ops-batch";
import { simpanOutletBulanan } from "@/lib/data/kpi";
import {
  BEBAN_BARU,
  BEBAN_BARU_LABELS,
  EXPENSE_COLS,
  EXPENSE_LABELS,
  PNL_LABELS,
  RINCI_UTILITAS,
  RINCI_UTILITAS_LABELS,
  expenseTotal,
  type ExpenseRow,
  type PnlRow,
  type PurchaseRow,
} from "@/lib/ops/categories";
import { TEMPLATE, barisKosong, kunciKembar, sidikBaris, type BarisUnggah } from "@/lib/ops/template-unggah";
import { utilitasBaris } from "@/lib/ops/utilitas";

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
  /** Baris yang seluruh angkanya kosong — tidak ditulis, dan disebut. */
  dilewati?: number;
  /** Ke mana saja angkanya masuk — dilaporkan balik, bukan diasumsikan. */
  tujuan?: string[];
  /** Baris yang kuncinya tidak dikenali — disebut, tidak didiamkan. */
  asing?: string[];
  /** Kode outlet yang muncul dua kali dalam satu berkas — berkasnya ditolak. */
  kembar?: string[];
  /** Benar bila berkas ini sudah pernah diunggah dan tidak ada yang berubah. */
  sudahPernah?: true;
  /** Berapa outlet yang utilitasnya datang dari rincian, bukan angka gabungan. */
  dirinci?: number;
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

export async function simpanUnggahAction(input: { periode: string; baris: BarisUnggah[] }): Promise<HasilUnggah> {
  const user = await getSessionUser();
  if (!user || !canReachMenu(user, MENU)) return { error: "Tidak punya akses." };
  if (!/^\d{4}-\d{2}$/.test(input.periode)) return { error: "Bulannya tidak dikenali." };
  if (input.baris.length === 0) return { error: "Tidak ada baris yang terbaca dari berkas itu." };

  // ── berkasnya sendiri harus sah dulu, sebelum menyentuh apa pun ──
  //
  // Dua baris untuk outlet yang sama pada bulan yang sama berarti berkasnya
  // salah. Menyimpan yang terakhir membuat separuh angkanya hilang tanpa satu
  // pun tanda — jadi ditolak, dan kodenya disebutkan supaya Excel-nya bisa
  // diperbaiki.
  const kembar = kunciKembar(input.baris);
  if (kembar.length > 0) {
    return {
      error: `${kembar.length} kode outlet muncul lebih dari sekali di berkas itu. Perbaiki Excel-nya dulu — tidak ada yang disimpan.`,
      kembar,
    };
  }

  try {
    return await simpan(input.periode, input.baris, user.id, user.name);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Gagal menyimpan." };
  }
}

async function simpan(periode: string, baris: BarisUnggah[], olehId: string, olehNama: string): Promise<HasilUnggah> {
  const peta = outletDariKode();
  const asing: string[] = [];
  let dilewati = 0;

  const pnl: PnlRow[] = [];
  const beli: PurchaseRow[] = [];
  const beban: ExpenseRow[] = [];
  const keKpi: { outletId: string; netProfit: number | null; hppNominal: number | null }[] = [];
  let dirinci = 0;

  // ── berkas yang sama persis tidak ditulis dua kali ──
  //
  // Sidiknya dihitung dari isi berkas, bukan namanya: mengunggah ulang berkas
  // yang sama adalah hal yang wajar dilakukan orang saat ragu apakah tadi
  // berhasil, dan menulis ulang seluruh barisnya hanya menambah risiko tanpa
  // menambah apa pun.
  const sidik = sidikBaris(TEMPLATE, baris);
  const sebelumnya = await batchSama(periode, sidik);
  if (sebelumnya) {
    return {
      ok: true,
      sudahPernah: true,
      tersimpan: sebelumnya.jumlahOutlet,
      tujuan: [...TEMPLATE.tujuan],
      dilewati: 0,
      asing: [],
    };
  }

  // Pendapatan tidak ada di berkas — yang sudah tersimpan dibaca dulu supaya
  // ikut dituliskan kembali apa adanya, bukan tergilas jadi nol.
  const pendapatanLama = new Map((await listPnl(periode)).map((r) => [r.outletCode, r.pendapatan]));
  // Utilitas yang sudah tersimpan, dengan alasan yang sama: berkas yang tidak
  // menyebut utilitas sama sekali tidak boleh menghapusnya.
  const utilitasLama = new Map((await listExpenses(periode)).map((r) => [r.outletCode, r.utilitas]));

  for (const b of baris) {
    const o = peta.get(b.kunci.trim().toLowerCase());
    if (!o) {
      asing.push(b.teks["Outlet"] || b.kunci);
      continue;
    }
    // Baris yang seluruh angkanya kosong berarti outlet itu tidak dilaporkan
    // bulan ini — bukan nol rupiah. Menulisnya akan menghapus angka yang sudah
    // benar hanya karena barisnya ikut terbawa di template.
    if (barisKosong(TEMPLATE, b)) {
      dilewati += 1;
      continue;
    }

    const rowBeban = { outletCode: o.code, outletName: o.name } as ExpenseRow;
    for (const c of EXPENSE_COLS) rowBeban[c] = b.angka[EXPENSE_LABELS[c]] ?? 0;
    // Enam kolom baru: kosong TETAP kosong. Kolomnya nullable, tidak seperti
    // delapan kolom lama.
    for (const c of BEBAN_BARU) rowBeban[c] = b.angka[BEBAN_BARU_LABELS[c]] ?? null;

    // ── utilitas: rincian yang menentukan, bukan angka gabungan ──
    const u = utilitasBaris({
      rincian: Object.fromEntries(RINCI_UTILITAS.map((c) => [c, b.angka[RINCI_UTILITAS_LABELS[c]] ?? null])),
      agregat: b.angka[EXPENSE_LABELS.utilitas] ?? null,
      tersimpan: utilitasLama.get(o.code) ?? null,
    });
    rowBeban.utilitas = u.utilitas;
    for (const c of RINCI_UTILITAS) rowBeban[c] = u.rincian[c];
    if (u.asal === "rincian") dirinci += 1;

    beban.push(rowBeban);

    beli.push({
      outletCode: o.code,
      outletName: o.name,
      warehouse: b.angka["Warehouse"] ?? 0,
      nonWarehouse: b.angka["Non Warehouse"] ?? 0,
    });

    pnl.push({
      outletCode: o.code,
      outletName: o.name,
      pendapatan: pendapatanLama.get(o.code) ?? 0,
      hpp: b.angka[PNL_LABELS.hpp] ?? 0,
      // Dijumlahkan dari rinciannya, tidak diketik terpisah: satu angka yang
      // bisa berbeda dari rinciannya cepat atau lambat akan berbeda.
      beban: expenseTotal(rowBeban),
      laba_bersih: b.angka[PNL_LABELS.laba_bersih] ?? 0,
    });

    keKpi.push({
      outletId: o.id,
      netProfit: b.angka[PNL_LABELS.laba_bersih],
      hppNominal: b.angka[PNL_LABELS.hpp],
    });
  }

  if (pnl.length === 0) {
    return {
      error: asing.length
        ? "Tidak ada kode outlet yang dikenali. Pakai template yang diunduh dari sini."
        : "Seluruh barisnya kosong — tidak ada angka untuk disimpan.",
      asing,
      dilewati,
    };
  }

  // Unggahan dicatat SEBELUM angkanya ditulis. Kalau penulisannya gagal di
  // tengah, yang tertinggal adalah catatan tanpa angka — kelihatan, bisa
  // diperiksa. Dibalik, yang tertinggal adalah angka tanpa asal-usul.
  const batchId = await catatBatch({
    periode,
    sidik,
    jumlahBaris: baris.length,
    jumlahOutlet: pnl.length,
    olehId,
    olehNama,
    catatan: dirinci > 0 ? `${dirinci} outlet utilitasnya dirinci` : null,
  });

  try {
    await upsertPnl(periode, pnl, batchId);
    await upsertPurchases(periode, beli, batchId);
    await upsertExpenses(periode, beban, batchId);
  } catch (e) {
    if (batchId != null) await tandaiGagal(batchId, e instanceof Error ? e.message : "gagal menulis");
    throw e;
  }

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

  for (const p of ["/operation/laba-rugi", "/operation/pembelian", "/operation/beban", "/kpi/operational_ca", "/kpi/pdq_food", "/kpi/pdq_beverage"]) {
    revalidatePath(p);
  }

  return { ok: true, tersimpan: pnl.length, dilewati, asing, dirinci, tujuan: [...TEMPLATE.tujuan] };
}
