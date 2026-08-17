"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { canReachMenu } from "@/lib/nav";
import { hapusProduksi, perbaruiProduksi, simpanProduksi, type ProduksiDraft } from "@/lib/data/produksi";
import { SATUAN_HASIL, type ProduksiMode } from "@/lib/produksi/calc";
import type { OverheadProduksi } from "@/lib/produksi/calc";
import type { UserProfile } from "@/lib/types";
import type { VariableItem } from "@/lib/hpp/calc";

/** Siapa yang boleh memakai kalkulator produksi gudang. */
const boleh = (u: UserProfile | null) => !!u && canReachMenu(u, "sc_hpp");

const MAKS_BARIS = 100;
const MAKS_TEKS = 120;

/**
 * Membersihkan kiriman dari peramban sebelum disimpan.
 *
 * Yang dijaga di sini bukan cuma tipe datanya. Satu resep dengan 50.000 baris
 * bahan akan membuat halaman siapa pun berhenti saat dibuka, dan nama sepanjang
 * satu paragraf merusak setiap tabel yang menampilkannya. Batasnya ditegakkan
 * di server, karena batas yang hanya ada di formulir bukan batas.
 */
function bersihkanBahan(v: unknown): VariableItem[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAKS_BARIS).map((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const angka = (x: unknown) => {
      const n = Number(x);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    return {
      id: String(o.id ?? `b${i}`).slice(0, 40),
      name: String(o.name ?? "").slice(0, MAKS_TEKS),
      takaran: angka(o.takaran),
      takaranUnit: String(o.takaranUnit ?? "g").slice(0, 10),
      buyPrice: angka(o.buyPrice),
      buyQty: angka(o.buyQty),
      buyUnit: String(o.buyUnit ?? "kg").slice(0, 10),
      ...(o.ingredientId ? { ingredientId: String(o.ingredientId).slice(0, 60) } : {}),
    } satisfies VariableItem;
  });
}

function bersihkanOverhead(v: unknown): OverheadProduksi[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAKS_BARIS).map((r, i) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const n = Number(o.biaya);
    return {
      id: String(o.id ?? `o${i}`).slice(0, 40),
      name: String(o.name ?? "").slice(0, MAKS_TEKS),
      biaya: Number.isFinite(n) && n >= 0 ? n : 0,
    };
  });
}

export interface ProduksiInputAksi {
  nama: string;
  kategori: string;
  mode: ProduksiMode;
  hasil: number;
  hasilUnit: string;
  susutPct: number;
  bahan: unknown;
  overhead: unknown;
  catatan: string;
}

function keDraft(input: ProduksiInputAksi): ProduksiDraft {
  const hasil = Number(input.hasil);
  const susut = Number(input.susutPct);
  return {
    nama: String(input.nama ?? "").trim().slice(0, MAKS_TEKS),
    kategori: String(input.kategori ?? "lainnya").slice(0, 40),
    mode: input.mode === "satuan" ? "satuan" : "batch",
    // Mode satuan selalu satu unit — dikunci di sini, bukan dipercayakan pada
    // formulir, supaya resep per-pcs tidak pernah punya hasil selain 1.
    hasil: input.mode === "satuan" ? 1 : Number.isFinite(hasil) && hasil >= 0 ? hasil : 0,
    hasilUnit: SATUAN_HASIL.includes(input.hasilUnit as (typeof SATUAN_HASIL)[number]) ? input.hasilUnit : "pcs",
    susutPct: Number.isFinite(susut) ? Math.min(100, Math.max(0, susut)) : 0,
    bahan: bersihkanBahan(input.bahan),
    overhead: bersihkanOverhead(input.overhead),
    catatan: String(input.catatan ?? "").trim().slice(0, 1000) || null,
  };
}

function segarkan() {
  revalidatePath("/supply-chain/hpp");
}

export async function simpanProduksiAction(input: ProduksiInputAksi) {
  const user = await getSessionUser();
  if (!boleh(user)) return { error: "Tidak punya akses." };
  const draft = keDraft(input);
  if (!draft.nama) return { error: "Nama produk wajib diisi." };
  if (draft.bahan.length === 0) return { error: "Tambahkan minimal satu bahan." };
  if (draft.mode === "batch" && draft.hasil <= 0) return { error: "Hasil sekali masak wajib diisi." };
  const res = await simpanProduksi(draft, user!.id);
  if (res.error) return { error: res.error };
  segarkan();
  return { ok: true, id: res.id };
}

export async function perbaruiProduksiAction(input: ProduksiInputAksi & { id: string }) {
  const user = await getSessionUser();
  if (!boleh(user)) return { error: "Tidak punya akses." };
  if (!input.id) return { error: "Resep tidak dikenal." };
  const draft = keDraft(input);
  if (!draft.nama) return { error: "Nama produk wajib diisi." };
  if (draft.bahan.length === 0) return { error: "Tambahkan minimal satu bahan." };
  if (draft.mode === "batch" && draft.hasil <= 0) return { error: "Hasil sekali masak wajib diisi." };
  const res = await perbaruiProduksi(input.id, draft);
  if (res.error) return { error: res.error };
  segarkan();
  return { ok: true };
}

export async function hapusProduksiAction(id: string) {
  const user = await getSessionUser();
  if (!boleh(user)) return { error: "Tidak punya akses." };
  const res = await hapusProduksi(id);
  if (res.error) return { error: res.error };
  segarkan();
  return { ok: true };
}
