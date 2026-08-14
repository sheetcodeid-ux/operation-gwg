import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { statusBerlaku, type JenisDokumen, type StatusBerlaku, type StatusDokumen } from "@/lib/hcmos/dokumen";

/**
 * Pusat Dokumen HC.
 *
 * Satu tabel melayani SOP kesembilan pilar, Kebijakan, Culture & Value,
 * dokumen kepatuhan, dan PKS Kemitraan — lihat catatan pada migrasinya.
 */

export interface DokumenRow {
  id: string;
  jenis: JenisDokumen;
  pilar: string | null;
  judul: string;
  ringkasan: string | null;
  isi: string | null;
  tautan: string | null;
  versi: string | null;
  pemilik: string | null;
  berlakuMulai: string | null;
  berlakuSampai: string | null;
  pihak: string | null;
  status: StatusDokumen;
  updatedAt: string;
  /** Dihitung dari `berlakuSampai`, tidak disimpan. */
  masaBerlaku: StatusBerlaku;
}

const KOLOM =
  "id,jenis,pilar,judul,ringkasan,isi,tautan,versi,pemilik,berlaku_mulai,berlaku_sampai,pihak,status,updated_at";

function toRow(r: Record<string, unknown>): DokumenRow {
  const berlakuSampai = (r.berlaku_sampai as string | null) ?? null;
  return {
    id: String(r.id),
    jenis: r.jenis as JenisDokumen,
    pilar: (r.pilar as string | null) ?? null,
    judul: String(r.judul ?? ""),
    ringkasan: (r.ringkasan as string | null) ?? null,
    isi: (r.isi as string | null) ?? null,
    tautan: (r.tautan as string | null) ?? null,
    versi: (r.versi as string | null) ?? null,
    pemilik: (r.pemilik as string | null) ?? null,
    berlakuMulai: (r.berlaku_mulai as string | null) ?? null,
    berlakuSampai,
    pihak: (r.pihak as string | null) ?? null,
    status: ((r.status as StatusDokumen) ?? "aktif") as StatusDokumen,
    updatedAt: String(r.updated_at ?? ""),
    masaBerlaku: statusBerlaku(berlakuSampai),
  };
}

/** Seluruh dokumen. Penyaringan per jenis/pilar dilakukan di tampilan supaya
 *  berpindah tab tidak memicu kueri baru — jumlahnya memang kecil. */
export async function listDokumen(): Promise<DokumenRow[]> {
  if (!dbEnabled) return [];
  const rows = await selectAll<Record<string, unknown>>("hc_documents", (from, to) =>
    db().from("hc_documents").select(KOLOM).order("judul").range(from, to),
  );
  return rows.map(toRow);
}

export interface SimpanDokumenInput {
  id?: string;
  jenis: JenisDokumen;
  pilar: string;
  judul: string;
  ringkasan: string;
  isi: string;
  tautan: string;
  versi: string;
  pemilik: string;
  berlakuMulai: string;
  berlakuSampai: string;
  pihak: string;
  status: StatusDokumen;
}

const nol = (v: string) => (v.trim() === "" ? null : v.trim());

export async function simpanDokumen(input: SimpanDokumenInput, olehId: string): Promise<{ id: string }> {
  if (!dbEnabled) throw new Error("Database tidak aktif.");
  const baris = {
    jenis: input.jenis,
    pilar: nol(input.pilar),
    judul: input.judul.trim(),
    ringkasan: nol(input.ringkasan),
    isi: nol(input.isi),
    tautan: nol(input.tautan),
    versi: nol(input.versi),
    pemilik: nol(input.pemilik),
    berlaku_mulai: nol(input.berlakuMulai),
    berlaku_sampai: nol(input.berlakuSampai),
    pihak: nol(input.pihak),
    status: input.status,
    updated_at: new Date().toISOString(),
    updated_by: olehId,
  };
  if (input.id) {
    const { error } = await db().from("hc_documents").update(baris).eq("id", input.id);
    if (error) throw new Error(error.message);
    return { id: input.id };
  }
  const { data, error } = await db().from("hc_documents").insert(baris).select("id").single();
  if (error) throw new Error(error.message);
  return { id: String(data.id) };
}

export async function hapusDokumen(id: string): Promise<void> {
  if (!dbEnabled) throw new Error("Database tidak aktif.");
  const { error } = await db().from("hc_documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
