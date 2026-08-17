import "server-only";

import { randomUUID } from "node:crypto";
import { db, dbEnabled } from "./db";
import { hitungProduksi, type OverheadProduksi, type ProduksiMode } from "@/lib/produksi/calc";
import type { VariableItem } from "@/lib/hpp/calc";

/**
 * Penyimpanan resep produksi gudang.
 *
 * Hasil hitungannya ikut disimpan, bukan dihitung ulang setiap kali daftar
 * dibuka. Alasannya bukan kecepatan semata: daftar dan rekap harus menampilkan
 * angka YANG SAMA dengan yang dilihat saat menyimpan. Menghitung ulang di
 * tempat lain berarti dua jalur perhitungan, dan begitu salah satunya berubah
 * angkanya berbeda tanpa ada yang tahu mana yang benar.
 *
 * Yang disimpan selalu dihitung ULANG DI SERVER dari bahan dan overhead —
 * tidak pernah menerima angka jadi dari formulir. Angka biaya yang bisa dikirim
 * bebas dari peramban tidak lagi bisa dipercaya siapa pun.
 */

export interface ProduksiRecord {
  id: string;
  nama: string;
  kategori: string;
  mode: ProduksiMode;
  hasil: number;
  hasilUnit: string;
  susutPct: number;
  bahan: VariableItem[];
  overhead: OverheadProduksi[];
  catatan: string | null;
  biayaBahan: number;
  biayaOverhead: number;
  totalBatch: number;
  hppPerUnit: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProduksiDraft = Pick<
  ProduksiRecord,
  "nama" | "kategori" | "mode" | "hasil" | "hasilUnit" | "susutPct" | "bahan" | "overhead" | "catatan"
>;

interface Row {
  id: string;
  nama: string;
  kategori: string;
  mode: ProduksiMode;
  hasil: number;
  hasil_unit: string;
  susut_pct: number;
  bahan: VariableItem[] | null;
  overhead: OverheadProduksi[] | null;
  catatan: string | null;
  biaya_bahan: number;
  biaya_overhead: number;
  total_batch: number;
  hpp_per_unit: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const mem = new Map<string, ProduksiRecord>();

function fromRow(r: Row): ProduksiRecord {
  return {
    id: r.id,
    nama: r.nama,
    kategori: r.kategori,
    mode: r.mode,
    hasil: Number(r.hasil) || 0,
    hasilUnit: r.hasil_unit,
    susutPct: Number(r.susut_pct) || 0,
    bahan: r.bahan ?? [],
    overhead: r.overhead ?? [],
    catatan: r.catatan,
    biayaBahan: Number(r.biaya_bahan) || 0,
    biayaOverhead: Number(r.biaya_overhead) || 0,
    totalBatch: Number(r.total_batch) || 0,
    hppPerUnit: Number(r.hpp_per_unit) || 0,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listProduksi(): Promise<ProduksiRecord[]> {
  if (!dbEnabled) return [...mem.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const { data } = await db().from("produksi_hpp").select("*").order("created_at", { ascending: false }).limit(300);
  return ((data ?? []) as Row[]).map(fromRow);
}

export async function getProduksi(id: string): Promise<ProduksiRecord | null> {
  if (!dbEnabled) return mem.get(id) ?? null;
  const { data } = await db().from("produksi_hpp").select("*").eq("id", id).maybeSingle();
  return data ? fromRow(data as Row) : null;
}

/** Bentuk baris siap simpan — hitungannya SELALU dari bahan & overhead. */
function keBaris(d: ProduksiDraft) {
  const h = hitungProduksi({
    bahan: d.bahan,
    overhead: d.overhead,
    hasil: d.hasil,
    hasilUnit: d.hasilUnit,
    susutPct: d.susutPct,
  });
  return {
    nama: d.nama,
    kategori: d.kategori,
    mode: d.mode,
    hasil: d.hasil,
    hasil_unit: d.hasilUnit,
    susut_pct: d.susutPct,
    bahan: d.bahan,
    overhead: d.overhead,
    catatan: d.catatan,
    biaya_bahan: h.biayaBahan,
    biaya_overhead: h.biayaOverhead,
    total_batch: h.totalBatch,
    hpp_per_unit: h.hppPerUnit,
  };
}

export async function simpanProduksi(d: ProduksiDraft, createdBy: string | null): Promise<{ id?: string; error?: string }> {
  const id = `prd_${randomUUID()}`;
  const baris = keBaris(d);
  if (!dbEnabled) {
    const now = new Date().toISOString();
    mem.set(id, {
      ...d,
      id,
      biayaBahan: baris.biaya_bahan,
      biayaOverhead: baris.biaya_overhead,
      totalBatch: baris.total_batch,
      hppPerUnit: baris.hpp_per_unit,
      createdBy,
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  }
  const { error } = await db().from("produksi_hpp").insert({ id, ...baris, created_by: createdBy });
  return error ? { error: error.message } : { id };
}

export async function perbaruiProduksi(id: string, d: ProduksiDraft): Promise<{ error?: string }> {
  const baris = keBaris(d);
  if (!dbEnabled) {
    const ada = mem.get(id);
    if (!ada) return { error: "Resep tidak ditemukan." };
    mem.set(id, {
      ...ada,
      ...d,
      biayaBahan: baris.biaya_bahan,
      biayaOverhead: baris.biaya_overhead,
      totalBatch: baris.total_batch,
      hppPerUnit: baris.hpp_per_unit,
      updatedAt: new Date().toISOString(),
    });
    return {};
  }
  const { error } = await db()
    .from("produksi_hpp")
    .update({ ...baris, updated_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { error: error.message } : {};
}

export async function hapusProduksi(id: string): Promise<{ error?: string }> {
  if (!dbEnabled) {
    mem.delete(id);
    return {};
  }
  const { error } = await db().from("produksi_hpp").delete().eq("id", id);
  return error ? { error: error.message } : {};
}
