import "server-only";

import { db, dbEnabled } from "./db";
import { selectAll } from "./paged";
import { getOutlets } from "./store";
import { TABEL_HCMOS, URUTAN_HCMOS, saringKolom, type TabelHcmos } from "@/lib/hcmos/tabel";
import { fk } from "./fk";

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
  // String kosong pada kolom penunjuk dinormalkan jadi "tidak ada" SEBELUM
  // menyentuh basis data. Formulir yang pilihannya dikosongkan mengirim `''`,
  // dan bagi Postgres itu sebuah nilai yang dicari di tabel tujuan — tidak
  // ketemu, lalu seluruh penyimpanan ditolak kunci asing. Persis begitulah satu
  // tiket IT Help Desk pernah macet total (lihat catatan di `data/fk.ts`).
  //
  // Dulu tidak ada tabel HC yang punya kunci asing, jadi celah ini belum pernah
  // terpicu di sini. Migrasi 0059 menambahkannya, jadi sekarang terpicu — dan
  // ditutup di jalur yang dilewati SELURUH tulisan HC-MOS, bukan di satu borang.
  const bersih = saringKolom(tabel, isi);
  for (const kunci of Object.keys(bersih)) {
    if (kunci.endsWith("_id") && typeof bersih[kunci] === "string") bersih[kunci] = fk(bersih[kunci] as string);
  }
  const baris = {
    ...bersih,
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
