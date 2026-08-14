import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { getOutlets } from "./store";
import { TABEL_HCMOS, URUTAN_HCMOS, saringKolom, type TabelHcmos } from "@/lib/hcmos/tabel";

/**
 * Baca/tulis umum untuk tabel pilar HC-MOS — lihat catatan di lib/hcmos/tabel.ts
 * soal mengapa satu jalur dipakai bersama, dan apa yang membuatnya aman.
 */

export type BarisHcmos = Record<string, unknown> & { id: string; outletName?: string | null };

/** Baris satu tabel, sudah membawa nama outlet bila tabelnya menyimpan outlet_id. */
export async function listTabel(tabel: TabelHcmos): Promise<BarisHcmos[]> {
  if (!dbEnabled) return [];
  const urut = URUTAN_HCMOS[tabel];
  const kolom = ["id", ...TABEL_HCMOS[tabel]].join(",");
  const rows = await selectAll<Record<string, unknown>>(tabel, (from, to) =>
    db().from(tabel).select(kolom).order(urut.kolom, { ascending: urut.naik, nullsFirst: false }).range(from, to),
  );
  const punyaOutlet = (TABEL_HCMOS[tabel] as readonly string[]).includes("outlet_id");
  const nama = punyaOutlet ? new Map(getOutlets().map((o) => [o.id, o.name])) : null;
  return rows.map((r) => ({
    ...r,
    id: String(r.id),
    outletName: nama && r.outlet_id ? (nama.get(String(r.outlet_id)) ?? null) : null,
  }));
}

/** Simpan satu baris — kolomnya disaring dulu terhadap daftar putih tabelnya. */
export async function simpanBaris(
  tabel: TabelHcmos,
  isi: Record<string, unknown>,
  id: string | undefined,
  olehId: string,
): Promise<void> {
  if (!dbEnabled) throw new Error("Database tidak aktif.");
  const baris = {
    ...saringKolom(tabel, isi),
    updated_at: new Date().toISOString(),
    updated_by: olehId,
  };
  const q = id ? db().from(tabel).update(baris).eq("id", id) : db().from(tabel).insert(baris);
  const { error } = await q;
  if (error) throw new Error(error.message);
}

export async function hapusBaris(tabel: TabelHcmos, id: string): Promise<void> {
  if (!dbEnabled) throw new Error("Database tidak aktif.");
  const { error } = await db().from(tabel).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
